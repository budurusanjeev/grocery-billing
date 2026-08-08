import * as Network from 'expo-network';
import { showMessage } from './ui';

// Checks the device's own network state (wifi/cell up + internet reachable)
// rather than trying a specific server, so the same check works before ANY
// API call (scan, item sync, bill upload, login) without depending on one
// endpoint being reachable. If the check itself throws, fail open — don't
// block the shopkeeper from trying an action just because this diagnostic
// couldn't run.
export async function isOnline(): Promise<boolean> {
  try {
    const state = await Network.getNetworkStateAsync();
    if (state.isConnected === false) return false;
    if (state.isInternetReachable === false) return false;
    return true;
  } catch {
    return true;
  }
}

// Call before any API-calling action (scan, sync, upload, login). Shows the
// same alert dialog used everywhere else in the app and returns false so the
// caller can bail out before even attempting the network request.
export async function requireInternet(): Promise<boolean> {
  const online = await isOnline();
  if (!online) {
    showMessage('No internet connection', 'Please check your internet connection and try again.');
  }
  return online;
}
