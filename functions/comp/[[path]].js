/**
 * Link previews for comp links — /comp and /comp/CP-XXXXX/…
 *
 * Messaging apps build a preview from the Open Graph tags in the raw HTML and
 * never run the app's JavaScript, so every route shows index.html's BetaLog
 * card. This Cloudflare Pages Function (picked up from `functions/` at the
 * repo root, the project's root directory) serves the same index.html with
 * those tags swapped for the comp card, `og-comp.png`, and the join code in
 * the title. The comp's name is not used: comps are readable only when signed
 * in (firestore.rules), and the code is all the link itself carries.
 *
 * Only /comp routes run it; everything else is served as before.
 */

var CODE = /^CP-[A-HJ-NP-Z2-9]{5}$/

export async function onRequest(context) {
  var res = await context.next()
  if (!(res.headers.get('content-type') || '').includes('text/html')) return res

  var url = new URL(context.request.url)
  var first = (url.pathname.split('/')[2] || '').toUpperCase()
  var code = CODE.test(first) ? first : null

  var title = code ? 'Join the comp · ' + code : 'BetaComp — climbing comps on BetaLog'
  var description = code
    ? "You're invited to a climbing comp. Open the link to see the details, enter, and score your goes on your phone."
    : 'Join a climbing comp with its code, or run your own. Climbers score on their phones and the leaderboard is live.'
  var tags = {
    'og:title': title,
    'og:description': description,
    'og:url': url.origin + (code ? '/comp/' + code : '/comp'),
    'og:image': url.origin + '/og-comp.png',
  }

  return new HTMLRewriter()
    .on('meta[property^="og:"]', {
      element: function (el) {
        var v = tags[el.getAttribute('property')]
        if (v) el.setAttribute('content', v)
      },
    })
    .on('meta[name="description"]', {
      element: function (el) { el.setAttribute('content', description) },
    })
    .on('title', {
      element: function (el) { el.setInnerContent(code ? title + ' — BetaLog' : 'BetaComp — BetaLog') },
    })
    .transform(res)
}
