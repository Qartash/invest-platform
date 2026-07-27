// Metro only splits the web bundle into chunks when this runtime is in the entry file;
// without it every `import()` is folded back into the one file everyone downloads first.
import '@expo/metro-runtime';

import { registerRootComponent } from 'expo';

import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
