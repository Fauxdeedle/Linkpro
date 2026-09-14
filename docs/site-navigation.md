# LINK Pro site navigation map

All public pages use the **same global nav** (from `components/site-nav.html`): About, Services, Classes, Courses, Blog, Reviews, and Book Now → `/#contact`. Rams is linked from footers, not the main nav.

```mermaid
flowchart TB
  subgraph globalNav [Global nav on every page]
    NAV["Logo → /"]
    NAV --> ABOUT["/about"]
    NAV --> SERVICES["/services"]
    NAV --> CLASSES["/classes"]
    NAV --> COURSES["/courses"]
    NAV --> BLOG["/blog"]
    NAV --> REVIEWS["/reviews"]
    NAV --> BOOK["/#contact"]
  end

  subgraph pages [HTML pages]
    HOME["/ index.html"]
    ABOUT_P["about.html"]
    SERVICES_P["services.html"]
    SOMA["somatherapy.html"]
    CLASSES_P["classes.html"]
    COURSES_P["courses.html"]
    BLOG_P["blog.html"]
    REVIEWS_P["reviews.html"]
    RAMS["rams.html"]
    PELVIS["pelvis-1-course.html"]
    CHECKOK["checkout-success.html"]
    CHECKNO["checkout-cancel.html"]
  end

  subgraph blogPosts [Blog articles]
    POST1["blog/your-pain-has-an-address.html"]
    POST2["blog/what-pro-teams-know-about-the-pelvis.html"]
  end

  subgraph coursesAnchors [courses.html sections]
    ONLINE["#online"]
    SEMINARS["#seminars"]
    UPCOMING["#upcoming"]
  end

  subgraph homeSections [Home in-page anchors]
    CONTACT["#contact"]
    PHIL["#philosophy"]
    COURSES_SEC["#courses"]
  end

  HOME --- globalNav
  ABOUT_P --- globalNav
  SERVICES_P --- globalNav
  SOMA --- globalNav
  CLASSES_P --- globalNav
  COURSES_P --- globalNav
  BLOG_P --- globalNav
  REVIEWS_P --- globalNav
  RAMS --- globalNav
  PELVIS --- globalNav
  CHECKOK --- globalNav
  CHECKNO --- globalNav
  POST1 --- globalNav
  POST2 --- globalNav

  BLOG_P --> POST1
  BLOG_P --> POST2
  POST1 --> BLOG_P
  POST2 --> BLOG_P

  COURSES_P --> ONLINE
  COURSES_P --> SEMINARS
  COURSES_P --> UPCOMING
  COURSES_P --> PELVIS

  HOME --> CONTACT
  BOOK --> CONTACT

  subgraph checkoutFlow [Checkout - not in nav]
    FLUTE["Flute hosted checkout"]
  end

  COURSES_P --> FLUTE
  FLUTE --> CHECKOK
  FLUTE -.-> CHECKNO
  CHECKOK --> PELVIS
  CHECKOK --> COURSES_P
  CHECKNO --> COURSES_P
```

## Footer-only and external links

| From | To |
|------|-----|
| Most footers | `/blog`, `/rams`, `/#contact`, Instagram |
| Course cards (home / courses) | External linkprosport.com enroll URLs |
| SomaTherapy | `/somatherapy` (content links; not in global nav) |

## Maintaining this map

When routes or nav links change, update `components/site-nav.html` and run `npm run build:nav`. See `.cursor/rules/site-navigation.mdc`.
