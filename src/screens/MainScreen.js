import React from 'react';
import { ActivityIndicator, AppState, FlatList, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { connect } from 'react-redux';
import * as Keychain from 'react-native-keychain';

import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import { faExchangeAlt } from '@fortawesome/free-solid-svg-icons';
import { loadHistory, newTx, resetData, setTokens, updateSelectedToken } from '../actions';
import HathorButton from '../components/HathorButton';
import TokenBar from '../components/TokenBar';
import { getShortHash, setSupportedBiometry, getSupportedBiometry, setBiometryEnabled, isBiometryEnabled } from '../utils';
import { LOCK_TIMEOUT } from '../constants';

import hathorLib from '@hathor/wallet-lib';


/**
 * txList {Array} array with transactions of the selected token
 * balance {Object} object with token balance {'available', 'locked'}
 * loadHistoryError {boolean} indicates if there's been an error loading tx history
 * historyLoading {boolean} indicates we're fetching history from server (display spinner)
 * selectedToken {string} uid of the selected token
 * tokens {Array} array with all added tokens on this wallet
 */
const mapStateToProps = (state) => ({
  txList: state.tokensHistory[state.selectedToken.uid] || [],
  balance: state.tokensBalance[state.selectedToken.uid] || {available: 0, locked: 0},
  loadHistoryError: state.loadHistoryError,
  historyLoading: state.historyLoading,
  selectedToken: state.selectedToken,
  tokens: state.tokens
})

const mapDispatchToProps = dispatch => {
  return {
    resetData: () => dispatch(resetData()),
    setTokens: tokens => dispatch(setTokens(tokens)),
    loadHistory: () => dispatch(loadHistory()),
    newTx: (newElement, keys) => dispatch(newTx(newElement, keys)),
    updateSelectedToken: token => dispatch(updateSelectedToken(token)),
  }
}

class MainScreen extends React.Component {
  backgroundTime = null;
  appState = 'active';

  componentDidMount() {
    this.getBiometry();
    const words = this.props.navigation.getParam('words', null);
    const pin = this.props.navigation.getParam('pin', null);
    if (words) {
      hathorLib.wallet.executeGenerateWallet(words, '', pin, pin, false);
      Keychain.setGenericPassword('', pin, {accessControl: Keychain.ACCESS_CONTROL.BIOMETRY_ANY, acessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY});
    } else {
      hathorLib.WebSocketHandler.setup();
      // user just started the app and wallet was already initialized, so lock screen
      this.props.navigation.navigate('PinScreen', {cb: this._onUnlockSuccess});
    }
    hathorLib.WebSocketHandler.on('wallet', this.handleWebsocketMsg);
    hathorLib.WebSocketHandler.on('reload_data', this.fetchDataFromServer);
    AppState.addEventListener('change', this._handleAppStateChange);
    // We need to update the redux tokens with data from localStorage, so the user doesn't have to add the tokens again
    this.updateReduxTokens();
    this.fetchDataFromServer();
  }

  componentWillUnmount() {
    hathorLib.WebSocketHandler.removeListener('wallet', this.handleWebsocketMsg);
    hathorLib.WebSocketHandler.removeListener('reload_data', this.fetchDataFromServer);
    AppState.removeEventListener('change', this._handleAppStateChange);
    this.props.resetData();
  }
  
  getBiometry = () => {
    Keychain.getSupportedBiometryType().then(biometryType => {
      switch (biometryType) {
        case Keychain.BIOMETRY_TYPE.TOUCH_ID:
        case Keychain.BIOMETRY_TYPE.FACE_ID:
          setSupportedBiometry(biometryType);
          break;
        default:
          setSupportedBiometry(null);
        // XXX Android Fingerprint is still not supported in the react native lib we're using.
        // https://github.com/oblador/react-native-keychain/pull/195
        //case Keychain.BIOMETRY_TYPE.FINGERPRINT:
      }
    });
  }

  _onUnlockSuccess = () => {
    this.backgroundTime = null;
  }

  _handleAppStateChange = (nextAppState) => {
    if (nextAppState === 'active') {
      if (this.appState === 'inactive') {
        // inactive state means the app wasn't in background, so no need to lock
        // the screen. This happens when user goes to app switch view or maybe is
        // asked for fingerprint or face if
        this.backgroundTime = null;
      } else if (Date.now() - this.backgroundTime > LOCK_TIMEOUT) {
        // this means app was in background for more than LOCK_TIMEOUT seconds,
        // so display lock screen
        this.props.navigation.navigate('PinScreen', {cb: this._onUnlockSuccess});
      } else {
        this.backgroundTime = null;
      }
    } else if (this.backgroundTime === null) {
      // app is leaving active state. Save timestamp to check if we need to lock
      // screen when it becomes active again
      this.backgroundTime = Date.now();
    }
    this.appState = nextAppState;
  }

  updateReduxTokens = () => {
    this.props.setTokens(hathorLib.tokens.getTokens());
  }

  fetchDataFromServer = () => {
    this.cleanData();
    this.props.loadHistory();
  }

  cleanData = () => {
    // Get old access data
    const accessData = hathorLib.storage.getItem('wallet:accessData');
    const walletData = hathorLib.wallet.getWalletData();
    const server = hathorLib.storage.getItem('wallet:server');
    const tokens = hathorLib.storage.getItem('wallet:tokens');

    const biometryEnabled = isBiometryEnabled();
    const supportedBiometry = getSupportedBiometry();
    hathorLib.storage.clear();

    let newWalletData = {
      keys: {},
      xpubkey: walletData.xpubkey,
    }

    hathorLib.storage.setItem('wallet:accessData', accessData);
    hathorLib.storage.setItem('wallet:data', newWalletData);
    hathorLib.storage.setItem('wallet:server', server);
    hathorLib.storage.setItem('wallet:tokens', tokens);
    setBiometryEnabled(biometryEnabled);
    setSupportedBiometry(supportedBiometry);
  }

  handleWebsocketMsg = wsData => {
    if (wsData.type === "wallet:address_history") {
      //TODO we also have to update some wallet lib data? Lib should do it by itself
      const walletData = hathorLib.wallet.getWalletData();
      const historyTransactions = 'historyTransactions' in walletData ? walletData['historyTransactions'] : {};
      const allTokens = 'allTokens' in walletData ? walletData['allTokens'] : [];
      hathorLib.wallet.updateHistoryData(historyTransactions, allTokens, [wsData.history], null, walletData)
      
      const newWalletData = hathorLib.wallet.getWalletData();
      const keys = newWalletData.keys;
      this.props.newTx(wsData.history, keys);
    }
  }

  tokenChanged = (token) => {
    this.props.updateSelectedToken(token);
  }

  render() {
    const colors = ['#eee', 'white'];

    const getValueColor = (item) => {
      if (item.is_voided) return 'black';
      if (item.balance > 0) return '#28a745';
      else if (item.balance < 0) return '#dc3545';
      else return 'black';
    }

    const renderItem = ({item, index}) => {
      return (
        <View style={[mainStyle.listItemWrapper, { backgroundColor: colors[index % 2] }]}>
          <Text style={[mainStyle.dateColumn, mainStyle.listColumn]}>{hathorLib.dateFormatter.parseTimestamp(item.timestamp)}</Text>
          <Text style={[mainStyle.idColumn, mainStyle.listColumn]}>{getShortHash(item.tx_id)}</Text>
          <Text style={[mainStyle.valueColumn, {color: getValueColor(item), textAlign: 'left' }]}>{item.is_voided ? '(Voided)' : hathorLib.helpers.prettyValue(item.balance)}</Text>
        </View>
      )
    }

    const renderListHeader = ({item}) => {
      if (this.props.historyLoading) return null;

      return (
        <View style={[mainStyle.listItemWrapper, { backgroundColor: 'white' }]}>
          <Text style={[mainStyle.dateColumn, mainStyle.listColumn]}>Date</Text>
          <Text style={[mainStyle.idColumn, mainStyle.listColumn]}>ID</Text>
          <Text style={[mainStyle.valueColumn, mainStyle.listColumn]}>Value</Text>
        </View>
      );
    }

    const renderTxHistory = () => {
      if (this.props.txList && (this.props.txList.length > 0)) {
        return (
          <View style={{ flex: 1, alignSelf: "stretch" }}>
            <Text style={{ fontWeight: "bold", textAlign: "center", fontSize: 20, margin: 16 }}>Transaction history</Text>
            <FlatList
              data={this.props.txList}
              renderItem={renderItem}
              keyExtractor={(item, index) => item.tx_id}
              ListHeaderComponent={renderListHeader}
              stickyHeaderIndices={[0]}
            />
          </View>
        );
      } else if (!this.props.historyLoading && !this.props.loadHistoryError) {
        //empty history
        return <Text style={{ fontSize: 16, textAlign: "center" }}>You don't have any transactions</Text>;
      } else if (!this.props.historyLoading && this.props.loadHistoryError) {
        return (
          <View>
            <Text style={{ fontSize: 16, textAlign: "center" }}>There's been an error connecting to the server</Text>
            <HathorButton
              style={{marginTop: 24}}
              onPress={this.fetchDataFromServer}
              title="Try again"
            />
          </View>
        );
      }
    }

    const renderBalance = () => {
      return (
        <View style={{ display: "flex", alignItems: "center" }}>
          <Text style={mainStyle.topText}>Total: {hathorLib.helpers.prettyValue(this.props.balance.available + this.props.balance.locked)} {this.props.selectedToken.symbol}</Text>
          <Text style={mainStyle.topText}>Available: {hathorLib.helpers.prettyValue(this.props.balance.available)} {this.props.selectedToken.symbol}</Text>
          <Text style={mainStyle.topText}>Locked: {hathorLib.helpers.prettyValue(this.props.balance.locked)} {this.props.selectedToken.symbol}</Text>
        </View>
      );
    }

    const renderTokenBarIcon = () => {
      return <FontAwesomeIcon icon={ faExchangeAlt } color='#ccc' />
    }

    return (
      <SafeAreaView style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <TokenBar
          key={this.props.selectedToken.uid}
          navigation={this.props.navigation}
          onChange={this.tokenChanged}
          tokens={this.props.tokens}
          defaultSelected={this.props.selectedToken.uid}
          icon={renderTokenBarIcon()}
          containerStyle={mainStyle.pickerContainerStyle}
        />
        <View style={{ display: "flex", flexDirection: "row", width: "100%", alignItems: "center", justifyContent: "space-around", height: 120, backgroundColor: "#0273a0", padding: 24 }}>
          {!this.props.historyLoading && renderBalance()}
          <View style={{ display: "flex", alignItems: "center" }}>
            <View style={{ padding: 4, borderColor: "white", borderWidth: 1, marginBottom: 8 }}>
              <Text style={{ lineHeight: 30, fontWeight: "bold", fontSize: 16, color: 'white' }}>Testnet</Text>
            </View>
          </View>
        </View>
        <View style={{ flex: 1, justifyContent: "center", alignSelf: "stretch" }}>
          {this.props.historyLoading && <ActivityIndicator size="large" animating={true} />}
          {!this.props.historyLoading && renderTxHistory()}
        </View>
      </SafeAreaView>
    );
  }
}

const mainStyle = StyleSheet.create({
  topText: {
    color: "white",
    lineHeight: 20,
  },
  topTextTitle: {
    color: "white",
    fontWeight: "bold",
    fontSize: 28,
  },
  listItemWrapper: {
    display: 'flex',
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'space-around',
    flexDirection: 'row',
    paddingBottom: 8,
    paddingTop: 8
  },
  dateColumn: {
    width: 170,
  },
  idColumn: {
    width: 100,
  },
  valueColumn: {
    flex: 0,
  },
  listColumn: {
    textAlign: 'center',
  },
  pickerContainerStyle: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100%',
  }
});

export default connect(mapStateToProps, mapDispatchToProps)(MainScreen)
