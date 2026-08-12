import immortals from '../assets/discover-lists/33-immortals.png'
import assassinsCreed from '../assets/discover-lists/assassins-creed-shadows.png'
import borderlands from '../assets/discover-lists/borderlands-4.png'
import fortnite from '../assets/discover-lists/fortnite.png'
import genshin from '../assets/discover-lists/genshin-impact.png'
import gta from '../assets/discover-lists/gta-v.png'
import honkai from '../assets/discover-lists/honkai-star-rail.png'
import infinityNikki from '../assets/discover-lists/infinity-nikki.png'
import marvelRivals from '../assets/discover-lists/marvel-rivals.png'
import mikiRoyale from '../assets/discover-lists/miki-royale.png'
import redDead from '../assets/discover-lists/red-dead-2.png'
import redDeadOnline from '../assets/discover-lists/red-dead-online.png'
import rocketLeague from '../assets/discover-lists/rocket-league.png'
import lastOfUs from '../assets/discover-lists/the-last-of-us-2.png'
import valorant from '../assets/discover-lists/valorant.png'

export const discoverShowcaseColumns = [
  {
    id: 'top-sellers',
    title: 'Top Sellers',
    items: [
      { id: 'marvel-rivals', title: 'Marvel Rivals', price: 'Free', image: marvelRivals },
      { id: 'honkai-star-rail', title: 'Honkai: Star Rail', price: 'Free', image: honkai },
      {
        id: 'red-dead-redemption-2',
        title: 'Red Dead Redemption 2',
        price: 'UAH 515',
        originalPrice: 'UAH 1030',
        discount: '-60%',
        image: redDead,
      },
      { id: 'infinity-nikki', title: 'Infinity Nikki', price: 'Free', image: infinityNikki },
      { id: 'genshin-impact', title: 'Genshin Impact', price: 'Free', image: genshin },
    ],
  },
  {
    id: 'most-played',
    title: 'Most Played',
    items: [
      { id: 'fortnite', title: 'Fortnite', price: 'Free', image: fortnite },
      { id: 'rocket-league', title: 'Rocket League', price: 'Free', image: rocketLeague },
      {
        id: 'red-dead-online',
        title: 'Red Dead Redemption 2',
        price: 'UAH 515',
        originalPrice: 'UAH 1030',
        discount: '-60%',
        image: redDeadOnline,
      },
      { id: 'grand-theft-auto-v', title: 'Grand Theft Auto V', price: 'UAH 735', image: gta },
      { id: 'valorant', title: 'Valorant', price: 'Free', image: valorant },
    ],
  },
  {
    id: 'upcoming-wishlisted',
    title: 'Top Upcoming Wishlisted',
    items: [
      { id: 'assassins-creed-shadows', title: 'Assasins Creed Shadows', price: 'UAH 890', image: assassinsCreed },
      { id: 'miki-royale', title: 'Miki Royale', price: 'Out on 3/10/25', image: mikiRoyale },
      { id: '33-immortals', title: '33 Immortals', price: 'Coming soon', image: immortals },
      { id: 'borderlands-4', title: 'Borderlands 4', price: 'Coming soon', image: borderlands },
      {
        id: 'the-last-of-us-part-ii-remastered',
        title: 'The Last of Us™ Part II Remastered',
        price: 'UAH 735',
        image: lastOfUs,
      },
    ],
  },
]
