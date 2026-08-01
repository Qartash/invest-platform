import React from 'react';
import { HeaderBackButton } from '@react-navigation/elements';
import { createNativeStackNavigator, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useTranslation } from 'react-i18next';
import { ProfileScreen } from '../screens/ProfileScreen';
import { EditProfileScreen } from '../screens/EditProfileScreen';
import { WalletScreen } from '../screens/investor/WalletScreen';
import { PortfolioScreen } from '../screens/investor/PortfolioScreen';
import { lazyScreen } from './lazyScreen';
import { ReferralScreen } from '../screens/referrals/ReferralScreen';
import { ReferralTreeScreen } from '../screens/referrals/ReferralTreeScreen';
import { ReferralEarningsScreen } from '../screens/referrals/ReferralEarningsScreen';
import { QuestsScreen } from '../screens/referrals/QuestsScreen';
import { PartnerScreen } from '../screens/referrals/PartnerScreen';
import { GuideScreen } from '../screens/GuideScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { useAuthStore } from '../store/authStore';

export type ProfileStackParamList = {
  Profile: undefined;
  Notifications: undefined;
  EditProfile: undefined;
  Wallet: undefined;
  Portfolio: undefined;
  Reports: undefined;
  Referrals: undefined;
  ReferralTree: undefined;
  ReferralEarnings: undefined;
  Quests: undefined;
  Partner: undefined;
  Guide: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

// Admin-only, and one of the heaviest screens in the app — fetched when an admin actually
// opens it rather than shipped to everyone who signs in.
const ReportsScreen = lazyScreen(() =>
  import('../screens/ReportsScreen').then((m) => ({ default: m.ReportsScreen })),
);

// Wallet/Portfolio can also be reached by jumping in from a different tab (e.g.
// "insufficient funds" while buying a ticket). When that happens before the
// Profile tab's own stack has ever mounted, there's no "Profile" screen behind
// this one to go back to — the native back button/gesture has nothing to do.
// Always navigating to the sibling "Profile" route (rather than relying on
// history) guarantees a way out no matter how this screen was reached.
function BackToProfileButton({ navigation }: { navigation: NativeStackNavigationProp<ProfileStackParamList, any> }) {
  return <HeaderBackButton displayMode="minimal" onPress={() => navigation.navigate('Profile')} />;
}

export function ProfileStackNavigator() {
  const { t } = useTranslation();
  // Reports is the platform-wide moderation dashboard — turnover across every account and a
  // by-name feed of everyone's deposits. Registering it only for admins keeps /reports from
  // being reachable by typing the URL now that the web build has real routes; the API
  // answers non-admins with 403 either way, so this is about not showing a broken screen.
  const isAdmin = useAuthStore((s) => s.user?.role === 'admin');
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Profile" component={ProfileScreen} />
      {/* Draws its own header, like Profile itself — see the note on the same
          screen in the home stack. */}
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ headerShown: true, title: t('profile.editProfile') }}
      />
      <Stack.Screen
        name="Wallet"
        component={WalletScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: t('wallet.title'),
          headerLeft: () => <BackToProfileButton navigation={navigation} />,
        })}
      />
      <Stack.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={({ navigation }) => ({
          headerShown: true,
          title: t('portfolio.title'),
          headerLeft: () => <BackToProfileButton navigation={navigation} />,
        })}
      />
      {isAdmin && (
        <Stack.Screen
          name="Reports"
          component={ReportsScreen}
          options={({ navigation }) => ({
            headerShown: true,
            title: t('reports.title'),
            headerLeft: () => <BackToProfileButton navigation={navigation} />,
          })}
        />
      )}
      <Stack.Screen
        name="Referrals"
        component={ReferralScreen}
        options={{ headerShown: true, title: t('referrals.title') }}
      />
      <Stack.Screen
        name="ReferralTree"
        component={ReferralTreeScreen}
        options={{ headerShown: true, title: t('referrals.treeTitle') }}
      />
      <Stack.Screen
        name="ReferralEarnings"
        component={ReferralEarningsScreen}
        options={{ headerShown: true, title: t('referrals.earningsTitle') }}
      />
      <Stack.Screen
        name="Quests"
        component={QuestsScreen}
        options={{ headerShown: true, title: t('quests.title') }}
      />
      <Stack.Screen
        name="Partner"
        component={PartnerScreen}
        options={{ headerShown: true, title: t('partners.title') }}
      />
      <Stack.Screen
        name="Guide"
        component={GuideScreen}
        options={{ headerShown: true, title: t('guide.title') }}
      />
    </Stack.Navigator>
  );
}
