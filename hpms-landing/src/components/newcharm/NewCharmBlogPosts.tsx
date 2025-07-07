import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';

const NewCharmBlogPosts: React.FC = () => {
  const blogPosts = [
    {
      id: 1,
      title: 'Understanding Dental Implants',
      category: 'Guides',
      date: { day: '15', month: 'Jan' },
      excerpt: 'Discover everything you need to know about dental implants, from the procedure to recovery and long-term care.',
      image: 'https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&h=362&fit=crop',
      author: {
        name: 'Dr. Anna Timoteus',
        avatar: 'https://ui-avatars.com/api/?name=Anna+Timoteus&background=32b9e5&color=fff'
      },
      comments: 3,
      link: '#'
    },
    {
      id: 2,
      title: 'The Benefits of Teeth Whitening',
      category: 'Cosmetic',
      categorySecondary: 'Trends',
      date: { day: '10', month: 'Jan' },
      excerpt: 'Professional teeth whitening can transform your smile. Learn about the latest techniques and what to expect.',
      image: 'https://images.unsplash.com/photo-1609207825181-52d3214556dd?w=600&h=362&fit=crop',
      author: {
        name: 'Dr. Monica Gustav',
        avatar: 'https://ui-avatars.com/api/?name=Monica+Gustav&background=32b9e5&color=fff'
      },
      comments: 5,
      link: '#'
    },
    {
      id: 3,
      title: 'Preventing Gum Disease',
      category: 'Prevention',
      categorySecondary: 'Guides',
      date: { day: '5', month: 'Jan' },
      excerpt: 'Learn how to protect your gums with proper oral hygiene techniques and regular dental check-ups.',
      image: 'https://images.unsplash.com/photo-1598256989800-fe5f95da9787?w=600&h=362&fit=crop',
      author: {
        name: 'Dr. Grace Festus',
        avatar: 'https://ui-avatars.com/api/?name=Grace+Festus&background=32b9e5&color=fff'
      },
      comments: 2,
      link: '#'
    },
    {
      id: 4,
      title: 'Kids Dental Care Tips',
      category: 'Pediatric',
      date: { day: '28', month: 'Dec' },
      excerpt: 'Essential tips for maintaining your child\'s oral health and making dental visits fun and stress-free.',
      image: 'https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?w=600&h=362&fit=crop',
      author: {
        name: 'Dr. Anna Timoteus',
        avatar: 'https://ui-avatars.com/api/?name=Anna+Timoteus&background=32b9e5&color=fff'
      },
      comments: 8,
      link: '#'
    }
  ];

  return (
    <section className="py-16 bg-gray-50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2 font-[Lexend]">
            Latest Posts
          </h2>
        </motion.div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {blogPosts.map((post, index) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="bg-white rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all duration-300">
                {/* Image Container */}
                <div className="relative overflow-hidden">
                  <a href={post.link} className="block">
                    <img
                      src={post.image}
                      alt={post.title}
                      className="w-full h-48 object-cover group-hover:scale-110 transition-transform duration-500"
                    />
                  </a>
                  
                  {/* Date Badge */}
                  <div className="absolute top-2.5 left-3 bg-gray-100 rounded-md px-2.5 py-2 text-center">
                    <div className="text-xl font-semibold text-gray-900 leading-none">{post.date.day}</div>
                    <div className="text-[9px] font-semibold uppercase text-gray-600 mt-0.5">{post.date.month}</div>
                  </div>

                  {/* Comments Badge */}
                  <div className="absolute top-4 right-5">
                    <div className="relative">
                      <Icon icon="solar:chat-round-line-bold" className="w-5 h-5 text-gray-100" />
                      <span className="absolute -top-1 -right-2 bg-[#32b9e5] text-white text-[11px] w-5 h-5 rounded-full flex items-center justify-center font-medium">
                        {post.comments}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="p-5">
                  {/* Categories */}
                  <div className="mb-2">
                    <span className="inline-block bg-gray-900 text-white text-[11px] font-semibold uppercase tracking-wider px-3.5 py-1.5 rounded-full">
                      {post.category}
                    </span>
                    {post.categorySecondary && (
                      <>
                        <span className="text-gray-400 mx-1">,</span>
                        <span className="inline-block bg-gray-900 text-white text-[11px] font-semibold uppercase tracking-wider px-3.5 py-1.5 rounded-full">
                          {post.categorySecondary}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Title */}
                  <h3 className="text-xl font-semibold text-gray-900 mb-2 font-[Poppins] leading-tight">
                    <a href={post.link} className="hover:text-[#32b9e5] transition-colors">
                      {post.title}
                    </a>
                  </h3>

                  {/* Excerpt */}
                  <p className="text-gray-600 text-sm leading-relaxed mb-4">
                    {post.excerpt}
                  </p>

                  {/* Continue Reading Button */}
                  <a
                    href={post.link}
                    className="inline-block pb-2 border-b border-[#32b9e5] text-[#32b9e5] text-sm font-semibold hover:text-[#2aa8d3] hover:border-[#2aa8d3] transition-all duration-300"
                  >
                    Continue Reading
                  </a>

                  {/* Author */}
                  <div className="flex items-center mt-5 pt-5 border-t border-gray-100">
                    <img
                      src={post.author.avatar}
                      alt={post.author.name}
                      className="w-7 h-7 rounded-full mr-2"
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {post.author.name}
                    </span>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>

        {/* Customer Testimonials Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 font-[Lexend]">
            Customers Testimonials
          </h2>

          <div className="grid md:grid-cols-2 gap-6">
            {/* Testimonial 1 */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-start space-x-4">
                <img
                  src="https://images.unsplash.com/photo-1589156191108-c762ff4b96ab?w=65&h=65&fit=crop&crop=face"
                  alt="Helena Shikongo"
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">Helena Shikongo</h4>
                    <span className="text-sm text-gray-500">– November 15, 2023</span>
                  </div>
                  <div className="flex items-center mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Icon
                        key={i}
                        icon="solar:star-bold"
                        className={`w-4 h-4 ${i < 4 ? 'text-[#ff5b5b]' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <p className="text-gray-600">
                    Dr. Timoteus and her team transformed my smile! The veneers look natural and I couldn't be happier with the results.
                  </p>
                </div>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white rounded-xl p-6 shadow-md">
              <div className="flex items-start space-x-4">
                <img
                  src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=65&h=65&fit=crop&crop=face"
                  alt="Johannes Nambinga"
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div className="flex-1">
                  <div className="flex items-baseline justify-between mb-2">
                    <h4 className="font-semibold text-gray-900">Johannes Nambinga</h4>
                    <span className="text-sm text-gray-500">– December 20, 2023</span>
                  </div>
                  <div className="flex items-center mb-3">
                    {[...Array(5)].map((_, i) => (
                      <Icon
                        key={i}
                        icon="solar:star-bold"
                        className={`w-4 h-4 ${i < 5 ? 'text-[#ff5b5b]' : 'text-gray-300'}`}
                      />
                    ))}
                  </div>
                  <p className="text-gray-600">
                    The dental implant procedure was painless and professional. NewCharm Dental exceeded all my expectations!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Instagram Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-8 font-[Lexend]">
            From Instagram
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-1.5">
            {[1, 2, 3, 4, 5].map((num) => (
              <a
                key={num}
                href="#"
                className="relative group overflow-hidden rounded-lg aspect-square"
              >
                <img
                  src={`https://images.unsplash.com/photo-${
                    num === 1 ? '1606811841689-23dfddce3e95' :
                    num === 2 ? '1588776814546-1ffcf47267a5' :
                    num === 3 ? '1609207825181-52d3214556dd' :
                    num === 4 ? '1598256989800-fe5f95da9787' :
                    '1559757175-5c350d0d3c56'
                  }?w=280&h=280&fit=crop`}
                  alt={`Instagram ${num}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                  <Icon icon="ri:instagram-fill" className="w-8 h-8 text-white" />
                </div>
              </a>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default NewCharmBlogPosts;