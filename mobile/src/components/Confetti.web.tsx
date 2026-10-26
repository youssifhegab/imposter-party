// lottie-react-native needs an extra player package on the web. The web build only exists for
// previewing screens, so confetti is skipped there; phones get the real animation.
export function Confetti() {
  return null;
}
