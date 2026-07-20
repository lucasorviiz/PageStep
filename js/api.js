/*
 * api.js — Open Library search wrapper.
 * Docs: https://openlibrary.org/dev/docs/api/search
 *
 * Keeps only the fields we need and builds cover URLs. Fails soft: if the
 * network is unavailable the caller can still fall back to a manual add.
 */
(function () {
  "use strict";

  var SEARCH_URL = "https://openlibrary.org/search.json";

  function coverUrl(coverId, size) {
    if (!coverId) return null;
    // size: S | M | L
    return "https://covers.openlibrary.org/b/id/" + coverId + "-" + (size || "M") + ".jpg";
  }

  // Returns a Promise resolving to an array of normalized book results.
  function search(query, opts) {
    opts = opts || {};
    var limit = opts.limit || 15;
    var params = new URLSearchParams({
      q: query,
      limit: String(limit),
      // ask only for the fields we render — keeps the payload small
      fields: "key,title,author_name,first_publish_year,cover_i,number_of_pages_median,edition_count"
    });

    var url = SEARCH_URL + "?" + params.toString();

    return fetch(url, { headers: { "Accept": "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("Open Library returned " + res.status);
        return res.json();
      })
      .then(function (data) {
        var docs = (data && data.docs) || [];
        return docs.map(function (d) {
          return {
            olKey: d.key || null,
            title: d.title || "Untitled",
            author: (d.author_name && d.author_name.join(", ")) || "Unknown author",
            year: d.first_publish_year || null,
            coverId: d.cover_i || null,
            coverUrl: coverUrl(d.cover_i, "M"),
            pageCount: d.number_of_pages_median || null,
            source: "openlibrary"
          };
        });
      });
  }

  window.BookAPI = {
    search: search,
    coverUrl: coverUrl
  };
})();
