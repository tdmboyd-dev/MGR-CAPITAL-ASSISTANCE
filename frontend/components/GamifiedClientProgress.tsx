'use client'

import { motion } from 'framer-motion'
import { Trophy, Star, BadgeCheck, Target, Zap, Award, Gift, TrendingUp } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'

interface GamifiedClientProgressProps {
  progress: number // 0-100
  level: number
  badges: string[]
  estimatedRecovery: number
  daysToPayout: number
  streakDays?: number
  milestones?: {
    name: string
    completed: boolean
    reward: string
  }[]
}

const LEVELS = [
  { name: 'Newcomer', min: 0, color: 'from-gray-400 to-gray-500' },
  { name: 'Explorer', min: 1, color: 'from-green-400 to-green-500' },
  { name: 'Achiever', min: 2, color: 'from-blue-400 to-blue-500' },
  { name: 'Champion', min: 3, color: 'from-purple-400 to-purple-500' },
  { name: 'Legend', min: 4, color: 'from-yellow-400 to-amber-500' },
]

const BADGE_ICONS: Record<string, any> = {
  'quick-start': Zap,
  'document-master': BadgeCheck,
  'early-bird': Star,
  'communicator': Award,
  'milestone': Target,
  'referral': Gift,
}

const DEFAULT_MILESTONES = [
  { name: 'Documents Submitted', completed: true, reward: '+50 XP' },
  { name: 'ID Verified', completed: true, reward: '+100 XP' },
  { name: 'Agreement Signed', completed: true, reward: '+150 XP' },
  { name: 'Claim Filed', completed: false, reward: '+200 XP' },
  { name: 'Payout Received', completed: false, reward: 'Trophy Badge' },
]

export default function GamifiedClientProgress({
  progress = 45,
  level = 2,
  badges = ['quick-start', 'document-master'],
  estimatedRecovery = 25000,
  daysToPayout = 60,
  streakDays = 5,
  milestones = DEFAULT_MILESTONES,
}: Partial<GamifiedClientProgressProps>) {
  const currentLevel = LEVELS[Math.min(level, LEVELS.length - 1)]
  const nextLevel = LEVELS[Math.min(level + 1, LEVELS.length - 1)]

  return (
    <Card className="border-none shadow-xl overflow-hidden">
      {/* Header with gradient */}
      <div className={`bg-gradient-to-r ${currentLevel.color} text-white p-6`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm opacity-90">Your Recovery Journey</p>
            <h2 className="text-2xl font-bold mt-1">Level {level}: {currentLevel.name}</h2>
          </div>
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20 }}
          >
            <Trophy className="h-12 w-12 text-yellow-300" />
          </motion.div>
        </div>

        {/* Progress to next level */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-sm mb-2">
            <span>Progress to {nextLevel.name}</span>
            <span>{progress}%</span>
          </div>
          <Progress value={progress} className="h-3 bg-white/20" />
        </div>
      </div>

      <CardContent className="p-6 space-y-6">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="text-center p-4 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl"
          >
            <p className="text-3xl font-bold text-green-600">
              ${estimatedRecovery.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">Estimated Recovery</p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="text-center p-4 bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl"
          >
            <p className="text-3xl font-bold text-blue-600">{daysToPayout}</p>
            <p className="text-sm text-muted-foreground mt-1">Days to Payout</p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center p-4 bg-gradient-to-br from-purple-50 to-pink-100 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl"
          >
            <p className="text-3xl font-bold text-purple-600">{badges.length}</p>
            <p className="text-sm text-muted-foreground mt-1">Badges Earned</p>
          </motion.div>

          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-center p-4 bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl"
          >
            <div className="flex items-center justify-center gap-1">
              <Zap className="h-6 w-6 text-orange-500" />
              <p className="text-3xl font-bold text-orange-600">{streakDays}</p>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Day Streak</p>
          </motion.div>
        </div>

        {/* Badges Section */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <BadgeCheck className="h-5 w-5 text-yellow-500" />
            Badges Earned
          </h3>
          <div className="flex flex-wrap gap-3">
            {badges.map((badge, i) => {
              const Icon = BADGE_ICONS[badge] || Star
              return (
                <motion.div
                  key={badge}
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ delay: i * 0.1, type: 'spring' }}
                >
                  <Badge
                    variant="outline"
                    className="px-4 py-2 text-sm flex items-center gap-2 bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-300"
                  >
                    <Icon className="h-4 w-4 text-yellow-600" />
                    {badge.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                  </Badge>
                </motion.div>
              )
            })}
            {badges.length === 0 && (
              <p className="text-muted-foreground text-sm">Complete milestones to earn badges!</p>
            )}
          </div>
        </div>

        {/* Milestones */}
        <div>
          <h3 className="font-semibold mb-3 flex items-center gap-2">
            <Target className="h-5 w-5 text-blue-500" />
            Recovery Milestones
          </h3>
          <div className="space-y-3">
            {milestones.map((milestone, i) => (
              <motion.div
                key={milestone.name}
                initial={{ x: -20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: i * 0.1 }}
                className={`p-4 rounded-lg flex items-center justify-between ${
                  milestone.completed
                    ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                    : 'bg-muted'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    milestone.completed ? 'bg-green-500 text-white' : 'bg-muted-foreground/20'
                  }`}>
                    {milestone.completed ? (
                      <BadgeCheck className="h-5 w-5" />
                    ) : (
                      <span className="text-sm font-medium">{i + 1}</span>
                    )}
                  </div>
                  <div>
                    <p className={`font-medium ${milestone.completed ? 'text-green-700 dark:text-green-400' : ''}`}>
                      {milestone.name}
                    </p>
                    <p className="text-sm text-muted-foreground">{milestone.reward}</p>
                  </div>
                </div>
                {milestone.completed && (
                  <Badge variant="outline" className="text-green-600 border-green-300">
                    Complete
                  </Badge>
                )}
              </motion.div>
            ))}
          </div>
        </div>

        {/* Motivational Message */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white p-4 rounded-xl">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-8 w-8" />
            <div>
              <p className="font-semibold">You're making great progress!</p>
              <p className="text-sm opacity-90">
                Complete the next milestone to unlock the "Milestone Master" badge.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
