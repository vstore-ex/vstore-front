import accountAvatar from '../assets/avatar.webp'
import achievementBags from '../assets/account/ach-bags.png'
import achievementFinalBoss from '../assets/account/ach-final-boss.png'
import achievementFirstBattle from '../assets/account/ach-first-battle.png'
import achievementFirstSteps from '../assets/account/ach-first-steps.png'
import achievementGoingForward from '../assets/account/ach-going-forward.png'
import achievementHard from '../assets/account/ach-hard-achievement.png'
import bindingIsaacCover from '../assets/account/game-binding-isaac.png'
import hadesCover from '../assets/account/game-hades.png'
import marvelCover from '../assets/account/game-marvel-rivals.png'
import mordhauCover from '../assets/account/game-mordhau.png'
import teamFortressCover from '../assets/account/game-team-fortress-2.png'
import tinyRoguesCover from '../assets/account/game-tiny-rogues.png'
import hadesAchievementOne from '../assets/account/hades-ach-1.png'
import hadesAchievementTwo from '../assets/account/hades-ach-2.png'
import hadesAchievementThree from '../assets/account/hades-ach-3.png'
import isaacAchievementOne from '../assets/account/isaac-ach-1.png'
import isaacAchievementTwo from '../assets/account/isaac-ach-2.png'
import isaacAchievementThree from '../assets/account/isaac-ach-3.png'
import marvelAchievementOne from '../assets/account/marvel-ach-1.png'
import marvelAchievementTwo from '../assets/account/marvel-ach-2.png'
import marvelAchievementThree from '../assets/account/marvel-ach-3.png'
import mordhauAchievementOne from '../assets/account/mordhau-ach-1.png'
import mordhauAchievementTwo from '../assets/account/mordhau-ach-2.png'
import mordhauAchievementThree from '../assets/account/mordhau-ach-3.png'
import tf2AchievementOne from '../assets/account/tf2-ach-1.png'
import tf2AchievementTwo from '../assets/account/tf2-ach-2.png'
import tf2AchievementThree from '../assets/account/tf2-ach-3.png'
import tinyAchievementOne from '../assets/account/tiny-ach-1.png'
import tinyAchievementTwo from '../assets/account/tiny-ach-2.png'
import tinyAchievementThree from '../assets/account/tiny-ach-3.png'

export const accountProfile = {
  nickname: 'Nickname_320',
  level: 18,
  avatar: accountAvatar,
  stats: [
    { label: 'Games', value: 48 },
    { label: 'Achievements', value: 304 },
  ],
}

export const accountAchievements = [
  {
    id: 'hard-achievement',
    title: 'Hard achievement',
    completion: 5,
    icon: achievementFirstBattle,
  },
  {
    id: 'first-steps',
    title: 'First steps',
    completion: 90,
    icon: achievementFinalBoss,
  },
  {
    id: 'going-forward',
    title: 'Going forward',
    completion: 70,
    icon: achievementHard,
  },
  {
    id: 'bags',
    title: 'Collect all the "Bags o...',
    completion: 7,
    icon: achievementFirstSteps,
  },
  {
    id: 'first-battle',
    title: 'Complete your first ba...',
    completion: 60,
    icon: achievementGoingForward,
  },
  {
    id: 'final-boss',
    title: 'Final boss',
    completion: 10,
    icon: achievementBags,
  },
]

export const accountGames = [
  {
    id: 'tiny-rogues',
    title: 'Tiny Rogues',
    cover: tinyRoguesCover,
    hoursPlayed: 53,
    lastPlayed: '2 days ago',
    completion: 70,
    achievements: [tinyAchievementOne, tinyAchievementTwo, tinyAchievementThree],
  },
  {
    id: 'hades',
    title: 'Hades',
    cover: teamFortressCover,
    hoursPlayed: 20,
    lastPlayed: '6 days ago',
    completion: 20,
    achievements: [hadesAchievementOne, hadesAchievementTwo, hadesAchievementThree],
  },
  {
    id: 'mordhau',
    title: 'Mordhau',
    cover: hadesCover,
    hoursPlayed: 73,
    lastPlayed: '7 days ago',
    completion: 45,
    achievements: [mordhauAchievementOne, mordhauAchievementTwo, mordhauAchievementThree],
  },
  {
    id: 'team-fortress-2',
    title: 'Team Fortress 2',
    cover: bindingIsaacCover,
    hoursPlayed: 450,
    lastPlayed: '9 days ago',
    completion: 20,
    achievements: [tf2AchievementOne, tf2AchievementTwo, tf2AchievementThree],
  },
  {
    id: 'binding-of-isaac',
    title: 'The Binding Of Isaac Rebirth',
    cover: mordhauCover,
    hoursPlayed: 90,
    lastPlayed: '15 day ago',
    completion: 23,
    achievements: [isaacAchievementOne, isaacAchievementTwo, isaacAchievementThree],
  },
  {
    id: 'marvel-rivals',
    title: 'Marvel Rivals',
    cover: marvelCover,
    hoursPlayed: 500,
    lastPlayed: '20 days ago',
    completion: 100,
    achievements: [marvelAchievementOne, marvelAchievementTwo, marvelAchievementThree],
  },
]
