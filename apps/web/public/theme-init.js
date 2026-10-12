// Apply the preferred palette before Angular and the styles render the first frame.
(() => {
  let preference;
  try {
    preference = localStorage.getItem('vu2.theme');
  } catch {
    // System preference remains available when storage is blocked.
  }
  const theme =
    preference === 'dark' || preference === 'light'
      ? preference
      : window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light';
  document.documentElement.dataset.theme = theme;
  document
    .querySelector('meta[name="theme-color"]')
    .setAttribute('content', theme === 'dark' ? '#10151b' : '#f7f8fa');
})();
