(function () {
  var clerkPromise;

  function loadScript(src, attributes) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement('script');
      script.src = src;
      script.crossOrigin = 'anonymous';
      Object.keys(attributes || {}).forEach(function (name) {
        script.setAttribute(name, attributes[name]);
      });
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
          var clerkDomain;
          try {
            clerkDomain = atob(publishableKey.split('_')[2]).slice(0, -1);
          } catch {
            throw new Error('Invalid Clerk publishable key.');
          }
          if (!window.Clerk) {
            await loadScript(
              'https://' +
                clerkDomain +
                '/npm/@clerk/ui@1/dist/ui.browser.js'
            );
            await loadScript(
              'https://' +
                clerkDomain +
                '/npm/@clerk/clerk-js@6/dist/clerk.browser.js',
              { 'data-clerk-publishable-key': publishableKey }
            );
          }
          await window.Clerk.load({
            ui: { ClerkUI: window.__internal_ClerkUICtor },
          });
          return window.Clerk;
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
