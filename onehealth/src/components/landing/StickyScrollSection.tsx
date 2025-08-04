"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Icon } from "@iconify/react";
import Image from "next/image";

const features = [
  {
    title: "Smart Scheduling",
    description:
      "AI-powered appointment scheduling that reduces no-shows by 40% with automated reminders and intelligent time slot optimization.",
    icon: "solar:calendar-mark-bold-duotone",
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800",
    color: "from-purple-500 to-pink-500",
  },
  {
    title: "Patient Portal",
    description:
      "Give your patients 24/7 access to their health records, lab results, and appointment history through a secure, user-friendly portal.",
    icon: "solar:user-heart-bold-duotone",
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800",
    color: "from-blue-500 to-cyan-500",
  },
  {
    title: "Automated Billing",
    description:
      "Streamline your revenue cycle with automated insurance claims, payment processing, and comprehensive financial reporting.",
    icon: "solar:bill-list-bold-duotone",
    image: "https://images.unsplash.com/photo-1554224155-8d04cb21cd6c?w=800",
    color: "from-green-500 to-teal-500",
  },
  {
    title: "Clinical Documentation",
    description:
      "Comprehensive EHR system with customizable templates, voice-to-text notes, and intelligent clinical decision support.",
    icon: "solar:document-medicine-bold-duotone",
    image: "https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800",
    color: "from-orange-500 to-red-500",
  },
];

export function StickyScrollSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeFeatureIndex, setActiveFeatureIndex] = useState(0);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  // Create transforms for each feature
  const opacity0 = useTransform(
    scrollYProgress,
    [0, 0.05, 0.2, 0.25],
    [0, 1, 1, 0],
  );
  const scale0 = useTransform(
    scrollYProgress,
    [0, 0.05, 0.2, 0.25],
    [0.8, 1, 1, 0.8],
  );

  const opacity1 = useTransform(
    scrollYProgress,
    [0.25, 0.3, 0.45, 0.5],
    [0, 1, 1, 0],
  );
  const scale1 = useTransform(
    scrollYProgress,
    [0.25, 0.3, 0.45, 0.5],
    [0.8, 1, 1, 0.8],
  );

  const opacity2 = useTransform(
    scrollYProgress,
    [0.5, 0.55, 0.7, 0.75],
    [0, 1, 1, 0],
  );
  const scale2 = useTransform(
    scrollYProgress,
    [0.5, 0.55, 0.7, 0.75],
    [0.8, 1, 1, 0.8],
  );

  const opacity3 = useTransform(
    scrollYProgress,
    [0.75, 0.8, 0.95, 1],
    [0, 1, 1, 0],
  );
  const scale3 = useTransform(
    scrollYProgress,
    [0.75, 0.8, 0.95, 1],
    [0.8, 1, 1, 0.8],
  );

  const featureTransforms = [
    { opacity: opacity0, scale: scale0 },
    { opacity: opacity1, scale: scale1 },
    { opacity: opacity2, scale: scale2 },
    { opacity: opacity3, scale: scale3 },
  ];

  // Update active feature based on scroll
  useEffect(() => {
    const unsubscribe = scrollYProgress.on("change", (progress) => {
      const index = Math.min(
        Math.floor(progress * features.length),
        features.length - 1,
      );
      setActiveFeatureIndex(index);
    });
    return () => unsubscribe();
  }, [scrollYProgress]);

  return (
    <section ref={containerRef} className="relative" data-lenis-prevent>
      {/* Scroll spacer */}
      <div
        className="relative"
        style={{ height: `${features.length * 100}vh` }}
      >
        {/* Fixed container */}
        <div className="sticky top-0 left-0 w-full h-screen overflow-hidden bg-gray-50">
          <div className="container mx-auto px-4 h-full flex items-center">
            <div className="grid lg:grid-cols-2 gap-12 items-center w-full">
              {/* Text content */}
              <div className="space-y-8">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{
                      opacity: activeFeatureIndex === index ? 1 : 0,
                      y: activeFeatureIndex === index ? 0 : 20,
                      display: activeFeatureIndex === index ? "block" : "none",
                    }}
                    transition={{ duration: 0.5 }}
                    className="max-w-lg"
                  >
                    <div
                      className={`inline-flex p-3 rounded-2xl bg-gradient-to-r ${feature.color} mb-6`}
                    >
                      <Icon
                        icon={feature.icon}
                        className="w-8 h-8 text-white"
                      />
                    </div>
                    <h3 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
                      {feature.title}
                    </h3>
                    <p className="text-lg text-gray-600 leading-relaxed">
                      {feature.description}
                    </p>
                    <motion.button
                      whileHover={{ x: 5 }}
                      className="mt-6 inline-flex items-center gap-2 text-purple-600 font-semibold hover:text-purple-700 transition-colors"
                    >
                      Learn more
                      <Icon
                        icon="solar:arrow-right-bold-duotone"
                        className="w-5 h-5"
                      />
                    </motion.button>
                  </motion.div>
                ))}
              </div>

              {/* Image container */}
              <div className="hidden lg:block relative h-[600px]">
                {features.map((feature, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{
                      opacity: activeFeatureIndex === index ? 1 : 0,
                      scale: activeFeatureIndex === index ? 1 : 0.9,
                    }}
                    transition={{ duration: 0.5 }}
                    className="absolute inset-0"
                  >
                    <div className="relative w-full h-[500px] rounded-2xl overflow-hidden shadow-2xl">
                      <Image
                        src={feature.image}
                        alt={feature.title}
                        fill
                        className="object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
                      <div className="absolute bottom-8 left-8 right-8">
                        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-6">
                          <div className="flex items-center gap-3 mb-3">
                            <div
                              className={`p-2 rounded-lg bg-gradient-to-r ${feature.color}`}
                            >
                              <Icon
                                icon={feature.icon}
                                className="w-6 h-6 text-white"
                              />
                            </div>
                            <h4 className="font-semibold text-gray-900">
                              {feature.title}
                            </h4>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-gray-600">
                            <span className="flex items-center gap-1">
                              <Icon
                                icon="solar:check-circle-bold"
                                className="w-4 h-4 text-green-500"
                              />
                              Live Demo
                            </span>
                            <span className="flex items-center gap-1">
                              <Icon
                                icon="solar:users-group-rounded-bold"
                                className="w-4 h-4 text-blue-500"
                              />
                              Used by 500+ clinics
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
