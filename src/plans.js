// Plans and account pages for the services in SERVICES (logic.js), keyed by service name.
// Prices are kr per month for monthly billing, copied by hand from each service's own Swedish price page.
// Services without `plans` only get links: their prices couldn't be checked against an official page.
export const PLANS_CHECKED = '2026-10-29'

export const PLANS = {
  Netflix: { manage: 'https://www.netflix.com/ChangePlan', cancel: 'https://www.netflix.com/cancelplan',
    plans: [['Basic', 129], ['Standard', 169], ['Premium', 219]] },
  Spotify: { manage: 'https://www.spotify.com/se/account/subscription/', cancel: 'https://www.spotify.com/se/account/subscription/',
    plans: [['Premium Student', 70], ['Premium Individual', 149], ['Premium Duo', 199], ['Premium Family', 249]] },
  'HBO Max': { manage: 'https://www.hbomax.com/se/sv', cancel: 'https://www.hbomax.com/se/sv',
    plans: [['Basic med reklam', 89], ['Standard', 149], ['Premium', 189]], yearly: { 'Basic med reklam': 890, Standard: 1490, Premium: 1890 } },
  'Disney+': { manage: 'https://www.disneyplus.com/account/subscription', cancel: 'https://www.disneyplus.com/account/subscription',
    plans: [['Standard med reklam', 89], ['Standard', 129], ['Premium', 179]], yearly: { Standard: 1290, Premium: 1790 } },
  Storytel: { manage: 'https://www.storytel.com/se/account', cancel: 'https://www.storytel.com/se/account',
    plans: [['Flex', 99], ['Premium', 169], ['Unlimited', 249]] },
  'Apple (iCloud/App Store)': { manage: 'https://apps.apple.com/account/subscriptions', cancel: 'https://apps.apple.com/account/subscriptions',
    note: 'Allt du köper via App Store dras som APPLE.COM/BILL och sägs upp hos Apple, inte hos tjänsten.' },
  'YouTube Premium': { manage: 'https://www.youtube.com/paid_memberships', cancel: 'https://www.youtube.com/paid_memberships' },
  'Amazon Prime': { manage: 'https://www.amazon.se/gp/primecentral', cancel: 'https://www.amazon.se/gp/primecentral' },
  Viaplay: { manage: 'https://viaplay.se/account', cancel: 'https://viaplay.se/account' },
  'TV4 Play': { manage: 'https://www.tv4play.se/konto', cancel: 'https://www.tv4play.se/konto' },
  Claude: { manage: 'https://claude.ai/settings/billing', cancel: 'https://claude.ai/settings/billing' },
  ChatGPT: { manage: 'https://chatgpt.com/#settings/Subscription', cancel: 'https://chatgpt.com/#settings/Subscription' },
}
