(function () {
  var clerkPromise;

  function loadScript() {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src =
        'https://cdn.jsdelivr.net/npm/@clerk/clerk-js@6.35.0/dist/clerk.browser.js';
      script.crossOrigin = 'anonymous';
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error('Could not load sign-in service.'));
      };
      document.head.appendChild(script);
    });
  }

  async function getClerk() {
    if (!clerkPromise) {
      clerkPromise = fetch('/api/auth-config')
        .then(function (response) {
          return response.json().then(function (data) {
            if (!response.ok) {
              throw new Error(data.error || 'Authentication is unavailable.');
            }
            return data.publishableKey;
          });
        })
        .then(async function (publishableKey) {
          if (!window.Clerk) {
            await loadScript();
          }
          var clerk = new window.Clerk(publishableKey);
          await clerk.load();
          return clerk;
        });
    }
    return clerkPromise;
  }

  async function getToken() {
    var clerk = await getClerk();
    return clerk.session ? clerk.session.getToken() : null;
  }

  async function signIn() {
    var clerk = await getClerk();
    await clerk.openSignIn({
      redirectUrl: window.location.href,
      afterSignInUrl: window.location.href,
      afterSignUpUrl: window.location.href,
    });
  }

  window.LinkProAuth = {
    getClerk: getClerk,
    getToken: getToken,
    signIn: signIn,
  };
})();
