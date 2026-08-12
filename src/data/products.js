import apexCard from '../assets/discover/apex-card.png'
import apexHero from '../assets/discover/apex-hero.png'
import apexThumbOne from '../assets/discover/apex-thumb-1.png'
import apexThumbTwo from '../assets/discover/apex-thumb-2.png'
import emberlands from '../assets/discover/emberlands.png'
import endOfSun from '../assets/discover/end-of-sun.png'
import finalFantasy from '../assets/discover/final-fantasy-vii.png'
import kingdomCome from '../assets/discover/kingdom-come.png'
import werecleaner from '../assets/discover/werecleaner.png'
import farcryCard from '../assets/products/farcry-5-card.png'
import longvinterGameplay from '../assets/products/longvinter-gameplay.png'
import longvinterHero from '../assets/products/longvinter-hero.png'
import longvinterThumbOne from '../assets/products/longvinter-thumb-1.png'
import longvinterThumbTwo from '../assets/products/longvinter-thumb-2.png'
import longvinterThumbThree from '../assets/products/longvinter-thumb-3.png'
import longvinterThumbFour from '../assets/products/longvinter-thumb-4.png'
import rating16 from '../assets/products/rating-16.png'
import achievementAllDone from '../assets/achievements/all-done.png'
import achievementArmorUp from '../assets/achievements/armor-up.png'
import achievementFreedom from '../assets/achievements/freedom.png'
import achievementGetDown from '../assets/achievements/get-down.png'
import achievementHeadCollector from '../assets/achievements/head-collector.png'
import achievementKablooid from '../assets/achievements/kablooid.png'
import achievementMineFarmer from '../assets/achievements/mine-farmer.png'
import achievementNightlySniper from '../assets/achievements/nightly-sniper.png'
import achievementProfessionalNewbies from '../assets/achievements/professional-newbies.png'
import achievementStarOfRespect from '../assets/achievements/star-of-respect.png'
import achievementUltimateBugKiller from '../assets/achievements/ultimate-bug-killer.png'
import { discoverShowcaseColumns } from './discoverLists'

const defaultRequirements = {
  minimum: [
    'OS: Windows 10 64-bit',
    'Processor: Intel Core i5 or AMD Ryzen 3',
    'Memory: 8 GB RAM',
    'Graphics: GTX 960 / RX 470',
    'Storage: 30 GB available space',
  ],
  recommended: [
    'OS: Windows 11 64-bit',
    'Processor: Intel Core i7 or AMD Ryzen 5',
    'Memory: 16 GB RAM',
    'Graphics: GTX 1660 / RX 5600',
    'Storage: 30 GB available space',
  ],
}

const defaultReviews = [
  {
    id: 'review-1',
    author: '@NonGenericUser',
    date: 'Posted on: November 25',
    recommended: false,
    summary: "This user doesn't recommend this game",
    text: "While definitely better than it was at launch, it still feels far too shallow and repetitive. The combat is fun at first, but you'll be fighting the same enemies in the same environments with unfun modifiers again and again.",
    helpful: { yes: 22, no: 3 },
  },
  {
    id: 'review-2',
    author: '@user_generic',
    date: 'Posted on: November 23',
    recommended: true,
    summary: 'This user recommends this game',
    text: 'Great game. Extraction mode is best out there but needs some work on getting rid of cheaters.',
    helpful: { yes: 41, no: 5 },
  },
  {
    id: 'review-3',
    author: '@snow_runner',
    date: 'Posted on: November 23',
    recommended: true,
    summary: 'This user recommends this game',
    text: 'Really fun. I love the warfare and from campaign to co-op it keeps giving me small reasons to return.',
    helpful: { yes: 18, no: 1 },
  },
  {
    id: 'review-4',
    author: '@grumpyController',
    date: 'Posted on: November 24',
    recommended: false,
    summary: "This user doesn't recommend this game",
    text: 'Ergonomics feel rough, progression slows down too early, and several systems need more polish before I can recommend it.',
    helpful: { yes: 9, no: 7 },
  },
]

const longvinterAchievements = [
  {
    id: 'professional-newbies',
    title: 'Professional newbies',
    description: 'Complete the game at the easiest difficulty',
    completion: 95,
    icon: achievementProfessionalNewbies,
  },
  {
    id: 'ultimate-bug-killer',
    title: 'The ultimate bug killer',
    description: 'Sometimes you just gotta kill em',
    completion: 93,
    icon: achievementUltimateBugKiller,
  },
  {
    id: 'nightly-sniper',
    title: 'Nightly sniper',
    description: 'Kill 10 players in a single night',
    completion: 88,
    icon: achievementNightlySniper,
  },
  {
    id: 'star-of-respect',
    title: 'Star of respect',
    description: 'Complete a mission perfectly',
    completion: 70,
    icon: achievementStarOfRespect,
  },
  {
    id: 'head-collector',
    title: 'Head collector',
    description: 'Kill every type of enemy',
    completion: 56,
    icon: achievementHeadCollector,
  },
  {
    id: 'kablooid',
    title: 'KABLOOID',
    description: 'Make the biggest bomb possible',
    completion: 50,
    icon: achievementKablooid,
  },
  {
    id: 'armor-up',
    title: 'Armor up',
    description: 'Upgrade armor to the maximum',
    completion: 42,
    icon: achievementArmorUp,
  },
  {
    id: 'all-done',
    title: 'All done!',
    description: '',
    completion: 34,
    icon: achievementAllDone,
  },
  {
    id: 'mine-farmer',
    title: 'Mine farmer',
    description: 'Upgrade armor to the maximum',
    completion: 20,
    icon: achievementMineFarmer,
  },
  {
    id: 'get-down',
    title: 'Get down!',
    description: 'Help your teammate with a ping',
    completion: 15,
    icon: achievementGetDown,
  },
  {
    id: 'freedom',
    title: 'Freedom, against all odds',
    description: 'Defeat the final boss',
    completion: 10,
    icon: achievementFreedom,
  },
]

export const discoverProducts = [
  {
    id: 'longvinter',
    type: 'Base Game',
    title: 'Longvinter',
    price: 'UAH 279',
    image: longvinterHero,
    detail: {
      logoText: 'LONGVINTER',
      description:
        'Travel to Longvinter Island, research everything that makes it special, build your camp, trade resources, and uncover what others tried to hide.',
      gallery: [longvinterHero, longvinterThumbOne, longvinterThumbTwo, longvinterThumbThree, longvinterThumbFour],
      gameplayImage: longvinterGameplay,
      aboutTitle: 'Switching attack methods',
      about:
        'You have been assigned to travel to Longvinter Island to research everything that makes the island special and uncover what other organizations have desperately tried to hide.',
      meta: [
        ['Release Date', '24.05.2025'],
        ['Developer', 'Uuvana Studios'],
        ['Publisher', 'Uuvana Studios'],
      ],
      tags: ['Adventure', 'Multiplayer', 'Survival', 'Co-op'],
      requirements: defaultRequirements,
      rating: { image: rating16, age: '16+', notes: 'Mild Violence' },
      achievementsCount: 230,
      achievements: longvinterAchievements,
      reviews: defaultReviews,
    },
  },
  {
    id: 'farcry-5',
    type: 'Base Game',
    title: 'FARCRY 5',
    price: 'UAH 810',
    originalPrice: 'UAH 1620',
    discount: '-50%',
    image: farcryCard,
    detail: {
      logoText: 'FARCRY 5',
      description:
        'Welcome to Hope County, Montana. Stand up to a dangerous cult, explore a wide open world, and fight back your own way.',
      gallery: [farcryCard, farcryCard, farcryCard, farcryCard],
      gameplayImage: farcryCard,
      aboutTitle: 'Open-world action',
      about:
        'Explore a dangerous region, complete missions in any order, unlock new weapons, and create your own stories across the map.',
      meta: [
        ['Release Date', '27.03.2018'],
        ['Developer', 'Ubisoft Montreal'],
        ['Publisher', 'Ubisoft'],
      ],
      tags: ['Action', 'Shooter', 'Open World', 'Co-op'],
      requirements: defaultRequirements,
      rating: { image: rating16, age: '16+', notes: 'Violence' },
      achievements: ['Liberator', 'Arcade hero', 'Fishing master', 'Resistance', 'Specialist'],
      reviews: defaultReviews,
    },
  },
  {
    id: 'end-of-sun',
    type: 'Base Game',
    title: 'The End of the Sun',
    price: 'UAH 515',
    image: endOfSun,
  },
  {
    id: 'apex-legends',
    type: 'Base Game',
    title: 'Apex Legends',
    price: 'Free',
    image: apexCard,
    detail: {
      logoText: 'APEX LEGENDS',
      description:
        'A fast squad-based battle royale where legendary characters fight for glory across evolving arenas.',
      gallery: [apexHero, apexThumbOne, apexThumbTwo, apexCard],
      gameplayImage: apexThumbTwo,
      aboutTitle: 'Squad up and become a legend',
      about:
        'Choose a legend, master tactical abilities, and fight in fast matches with friends or solo queue teammates.',
      meta: [
        ['Release Date', '04.02.2019'],
        ['Developer', 'Respawn Entertainment'],
        ['Publisher', 'Electronic Arts'],
      ],
      tags: ['Battle Royale', 'Shooter', 'Multiplayer', 'Free to Play'],
      requirements: defaultRequirements,
      rating: { image: rating16, age: '16+', notes: 'Violence' },
      achievements: ['Jumpmaster', 'Champion', 'Squad wipe', 'Legendary loot', 'Arena veteran'],
      reviews: defaultReviews,
    },
  },
  {
    id: 'werecleaner',
    type: 'Base Game',
    title: 'The WereCleaner',
    price: 'UAH 325',
    image: werecleaner,
  },
  {
    id: 'emberlands',
    type: 'Base Game',
    title: 'The Emberlands',
    price: 'UAH 355',
    image: emberlands,
  },
  {
    id: 'kingdom-come',
    type: 'Base Game',
    title: 'Kingdom Come Deliverance II',
    price: 'UAH 1030',
    image: kingdomCome,
  },
  {
    id: 'final-fantasy-vii',
    type: 'Base Game',
    title: 'Final Fantasy VII',
    price: 'UAH 975',
    image: finalFantasy,
  },
]

export const products = [
  ...discoverProducts,
  ...discoverShowcaseColumns.flatMap((column) =>
    column.items.map((item) => ({
      type: 'Base Game',
      ...item,
    })),
  ),
]

export function getProductById(productId) {
  return products.find((product) => product.id === productId)
}
