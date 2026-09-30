(function () {
  var quotes = [
    {
      q: "I've taken all three of my kids to Dr. Jason Amstutz at LINK Pro, and I would recommend him to anyone — especially parents. He caught issues early, before they turned into bigger problems.",
      a: "Justin N.",
      r: "Google review · Parent"
    },
    {
      q: "This review of Link Medical Center is long overdue. About 5 years ago, I suddenly could barely walk. I had always been active — walking, yoga, body pump. What felt like a little discomfort escalated to the point of barely being able to walk.",
      a: "Deets",
      r: "Google review"
    },
    {
      q: "I cannot express how much Dr. Amstutz has changed my life. After being in so much pain for so long, I had given up hope of ever being pain free. After 4 visits I was able to sleep through the night without waking up in pain.",
      a: "Sylvia Wesley",
      r: "Google review"
    },
    {
      q: "He didn't just review structures — he connected them directly to specific techniques that can improve joint movement and function in our athletes.",
      a: "Taka",
      r: "Assistant Athletic Trainer, Atlanta Hawks"
    },
    {
      q: "This guy is easily above par with any other medical treatment I've ever received. His bedside manner is the best I've ever experienced.",
      a: "R.M.",
      r: "2014 Olympic Hopeful"
    },
    {
      q: "Dr. Amstutz was able to pinpoint where the issue was originating from, so I can work toward correcting it, rather than simply putting a bandaid on it.",
      a: "C.L.",
      r: "Age Group Athlete"
    }
  ];

  var roots = document.querySelectorAll("[data-quote-rotate]");
  if (!roots.length) return;

  var index = Math.floor(Math.random() * quotes.length);

  function paint(item, instant) {
    roots.forEach(function (root) {
      var quote = root.querySelector("[data-quote-text]");
      var attribution = root.querySelector("[data-quote-attr]");

      function apply() {
        if (quote) quote.textContent = '"' + item.q + '"';
        if (attribution) {
          attribution.textContent = item.a + " ";
          var role = document.createElement("span");
          role.textContent = item.r;
          attribution.appendChild(role);
        }
        root.style.opacity = "1";
      }

      if (instant) {
        apply();
        return;
      }

      root.style.opacity = "0";
      window.setTimeout(apply, 280);
    });
  }

  paint(quotes[index], true);
  window.setInterval(function () {
    index = (index + 1) % quotes.length;
    paint(quotes[index], false);
  }, 8000);
})();
