import React from 'react';
import { Pressable, Text } from 'react-native';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { WalletScreen } from '../screens/investor/WalletScreen';
import { PortfolioScreen } from '../screens/investor/PortfolioScreen';
import { colors, spacing } from '../theme';

export type ProfileStackParamList = {
  Profile: undefined;
  EditProfile: undefined;
  Wallet: undefined;
  Portfolio: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// Wallet/Portfolio can also be reached by jumping in from a different tab (e.g.
// "insufficient funds" while buying a ticket). When that happens before the
// Profile tab's own stack has ever mounted, there's no "Profile" screen behind
// this one to go back to — the native back button/gesture has nothing to do.
// Always navigating to the sibling "Profile" route (rather than relying on
// history) guarantees a way out no matter how this screen was reached.
function BackToProfileButton({ navigation }: { navigation: NativeStackNavigationProp<ProfileStackParamList, any> }) {
  const { t } = useTranslation();
  return (
    <Pressable onPress={() => navigation.navigate('Profile')} hitSlop={10} style={{ paddingHorizontal: spacing.sm }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: colors.primary }}>‹ {t('common.back')}</Text>
    </Pressable>
  );
}

export function ProfileStackNavigator() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ headerShown: true, title: '' }} />
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: '',
          headerLeft: () => <BackToProfileButton navigation={navigation} />,
        })}
      />
      <Stack.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: '',
          headerLeft: () => <BackToProfileButton navigation={navigation} />,
        })}
      />
    </Stack.Navigator>
  );
}
