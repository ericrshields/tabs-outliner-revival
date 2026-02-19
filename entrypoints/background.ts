export default defineBackground(() => {
  console.log('Tabs Outliner Revival: background service worker started', {
    id: browser.runtime.id,
  });
});
