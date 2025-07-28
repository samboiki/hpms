'use client'

import { motion } from 'framer-motion'
import { Icon } from '@iconify/react'
import { useInView } from 'react-intersection-observer'
import Link from 'next/link'
import { Button } from '@/components/ui/button'

const pricingPlans = [
  {
    name: 'Starter',
    description: 'Perfect for solo practitioners',
    price: 'N$999',
    period: '/month',
    popular: false,
    features: [
      'Up to 100 patients',
      'Basic appointment scheduling',
      'SMS reminders (100/month)',
      'Basic reporting',
      'Email support',
      'Mobile app access',
    ],
    color: 'from-blue-500 to-cyan-500',
  },
  {
    name: 'Professional',
    description: 'Ideal for growing practices',
    price: 'N$2,499',
    period: '/month',
    popular: true,
    features: [
      'Unlimited patients',
      'Advanced scheduling & calendar',
      'SMS reminders (1000/month)',
      'Email automation (500/month)',
      'Custom forms & documents',
      'Multi-user access (up to 5)',
      'Priority support',
      'API access',
    ],
    color: 'from-purple-500 to-pink-500',
  },
  {
    name: 'Enterprise',
    description: 'For multi-branch practices',
    price: 'N$4,999',
    period: '/month',
    popular: false,
    features: [
      'Everything in Professional',
      'Multi-branch management',
      'Unlimited SMS & Email',
      'Advanced analytics & AI reports',
      'Custom integrations',
      'Unlimited users',
      'Dedicated account manager',
      'On-premise deployment option',
      'Custom training',
    ],
    color: 'from-green-500 to-teal-500',
  },
]

export function PricingSection() {
  const [ref, inView] = useInView({
    triggerOnce: true,
    threshold: 0.1,
  })

  return (
    <section className="py-24 bg-gray-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-purple-100 to-pink-100 rounded-full blur-3xl opacity-30" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tr from-blue-100 to-cyan-100 rounded-full blur-3xl opacity-30" />

      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-100 to-teal-100 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:tag-price-bold-duotone" className="w-5 h-5 text-green-600" />
            <span className="text-sm font-semibold text-green-700">Simple, Transparent Pricing</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Choose the Perfect Plan for
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-green-600 to-teal-600"> Your Practice</span>
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            No hidden fees. No surprise charges. Start with a 14-day free trial on any plan.
          </p>
        </motion.div>

        <div ref={ref} className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {pricingPlans.map((plan, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 20 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              whileHover={{ scale: 1.02, y: -5 }}
              className="relative"
            >
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 z-10">
                  <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    Most Popular
                  </div>
                </div>
              )}

              <div className={`relative bg-white rounded-2xl shadow-xl overflow-hidden h-full ${
                plan.popular ? 'ring-2 ring-purple-500' : ''
              }`}>
                {/* Header */}
                <div className={`bg-gradient-to-r ${plan.color} p-8 text-white`}>
                  <h3 className="text-2xl font-bold mb-2">{plan.name}</h3>
                  <p className="text-white/90 mb-4">{plan.description}</p>
                  <div className="flex items-baseline">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-white/80 ml-1">{plan.period}</span>
                  </div>
                </div>

                {/* Features */}
                <div className="p-8">
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature, featureIndex) => (
                      <motion.li
                        key={featureIndex}
                        initial={{ opacity: 0, x: -20 }}
                        animate={inView ? { opacity: 1, x: 0 } : {}}
                        transition={{ duration: 0.3, delay: 0.3 + featureIndex * 0.05 }}
                        className="flex items-start gap-3"
                      >
                        <Icon 
                          icon="solar:check-circle-bold-duotone" 
                          className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" 
                        />
                        <span className="text-gray-700">{feature}</span>
                      </motion.li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link href="/auth/register">
                    <Button
                      className={`w-full py-6 text-lg font-semibold rounded-xl transition-all duration-200 ${
                        plan.popular
                          ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:shadow-lg'
                          : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                      }`}
                    >
                      Start Free Trial
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-16 text-center"
        >
          <div className="inline-flex flex-col sm:flex-row items-center gap-8 bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center gap-3">
              <Icon icon="solar:shield-check-bold-duotone" className="w-8 h-8 text-green-600" />
              <div className="text-left">
                <p className="font-semibold text-gray-900">14-Day Free Trial</p>
                <p className="text-sm text-gray-600">No credit card required</p>
              </div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-gray-200" />
            <div className="flex items-center gap-3">
              <Icon icon="solar:refresh-circle-bold-duotone" className="w-8 h-8 text-blue-600" />
              <div className="text-left">
                <p className="font-semibold text-gray-900">Cancel Anytime</p>
                <p className="text-sm text-gray-600">No long-term contracts</p>
              </div>
            </div>
            <div className="hidden sm:block w-px h-12 bg-gray-200" />
            <div className="flex items-center gap-3">
              <Icon icon="solar:chat-round-money-bold-duotone" className="w-8 h-8 text-purple-600" />
              <div className="text-left">
                <p className="font-semibold text-gray-900">Money-Back Guarantee</p>
                <p className="text-sm text-gray-600">30-day satisfaction guarantee</p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Custom Plans */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={inView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-gray-600 mb-4">
            Need a custom plan for your organization?
          </p>
          <Link href="/contact">
            <Button variant="outline" size="lg" className="font-semibold">
              Contact Sales
              <Icon icon="solar:arrow-right-bold-duotone" className="ml-2 w-5 h-5" />
            </Button>
          </Link>
        </motion.div>
      </div>
    </section>
  )
}