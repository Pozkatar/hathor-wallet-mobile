import React from 'react';
import {
  Linking,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Text,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { t } from 'ttag';
import VersionNumber from 'react-native-version-number';
import HathorHeader from '../components/HathorHeader';
import Logo from '../components/Logo';
import TextFmt from '../components/TextFmt';
import baseStyle from '../styles/init';
import { str2jsx } from '../utils';

export class About extends React.Component {
  style = Object.assign({}, baseStyle, StyleSheet.create({
    view: {
      padding: 16,
      justifyContent: 'space-between',
      flexGrow: 1,
    },
    logoView: {
      marginTop: 16,
      marginBottom: 16,
    },
  }));

  touchCount = 0;

  onPressLogo = () => {
    // Method created to test error handling
    this.touchCount += 1;
    if (this.touchCount === 10) {
      throw new Error('Hathor test error.');
    }
  }

  render() {
    const Link = (props) => (
      <Text
        style={this.style.link}
        onPress={() => Linking.openURL(props.href)}
      >
        {props.children}
      </Text>
    );

    return (
      <SafeAreaView style={{ flex: 1 }}>
        <HathorHeader
          title={t`ABOUT`}
          onBackPress={() => this.props.navigation.goBack()}
        />
        <ScrollView pinchGestureEnabled={false} contentContainerStyle={this.style.view}>
          <TouchableWithoutFeedback onPress={this.onPressLogo}>
            <View style={this.props.logoView}>
              <Logo />
            </View>
          </TouchableWithoutFeedback>
          <Text style={this.style.text}>{`v${VersionNumber.appVersion} (build ${VersionNumber.buildVersion})`}</Text>

          <Text style={this.style.title}>Hathor Labs</Text>
          <Text style={this.style.text}>
            {t`This app is developed by Nina Duong Haute Couture and is distributed for free.`}
          </Text>

          <TextFmt style={this.style.text}>
            {t`This wallet is connected to the **mainnet**.`}
          </TextFmt>
          <Text style={this.style.text}>
            {t`A mobile wallet is not the safest place to store your tokens.
            So, we advise you to keep only a small amount of tokens here, such as pocket money.`}
          </Text>
          <Text style={this.style.text}>
            {str2jsx(
              t`For further information, check out our website |link:htts://www.ninaduong.com/|.`,
              { link: (x, i) => <Link key={i} href='http://ninaduong.com/'>{x}</Link> }
            )}
          </Text>

          <Text style={this.style.title}>MIT License</Text>
          <Text style={this.style.text}>Copyright 2020 Nina Duong Haute Couture</Text>
          <Text style={this.style.text}>
            Permission is hereby granted, free of charge, to any person obtaining a copy of this
            {' '}software and associated documentation files (the &quot;Software&quot;), to deal in
            {' '}the Software without restriction, including without limitation the rights to use,
            {' '}copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the
            {' '}Software, and to permit persons to whom the Software is furnished to do so,
            {' '}subject to the following conditions:
          </Text>
          <Text style={this.style.text}>
            The above copyright notice and this permission notice shall be included in all
            {' '}copies or substantial portions of the Software.
          </Text>
          <Text style={this.style.text}>
            THE SOFTWARE IS PROVIDED &quot;AS IS&quot;, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
            {' '}IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
            {' '}FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
            {' '}COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN
            {' '}AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
            {' '}WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
          </Text>
        </ScrollView>
      </SafeAreaView>
    );
  }
}

export default About;
