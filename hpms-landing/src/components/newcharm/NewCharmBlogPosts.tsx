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
      image: '/images/newcharm/Screenshot 2025-07-07 074514.png',
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
      image: '/images/newcharm/Screenshot 2025-07-07 074718.png',
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
      image: '/images/newcharm/Screenshot 2025-07-07 074207.png',
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
      image: '/images/newcharm/Screenshot 2025-07-07 074654.png',
      author: {
        name: 'Dr. Anna Timoteus',
        avatar: 'https://ui-avatars.com/api/?name=Anna+Timoteus&background=32b9e5&color=fff'
      },
      comments: 8,
      link: '#'
    }
  ];

  return (
    <section id="blog" className="py-20 bg-white border-t border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div 
          className="text-center max-w-3xl mx-auto mb-12"
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <div className="inline-flex items-center space-x-2 bg-[#32b9e5]/10 px-4 py-2 rounded-full mb-4">
            <Icon icon="solar:document-text-bold-duotone" className="w-4 h-4 text-[#32b9e5]" />
            <span className="text-sm text-[#32b9e5] font-medium">Our Blog</span>
          </div>
          <h2 className="text-3xl md:text-4xl font-lexend font-light text-gray-900 mb-4">
            Latest dental health
            <span className="text-[#32b9e5] font-normal"> insights</span>
          </h2>
          <p className="text-base text-gray-600 leading-relaxed">
            Stay informed with expert advice and tips for maintaining optimal oral health.
          </p>
        </motion.div>

        {/* Blog Posts Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {blogPosts.map((post, index) => (
            <motion.article
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="group"
            >
              <div className="bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-1">
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
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur-sm rounded-lg px-3 py-2 text-center shadow-md">
                    <div className="text-xl font-bold text-[#32b9e5] leading-none">{post.date.day}</div>
                    <div className="text-[10px] font-semibold uppercase text-gray-600 mt-0.5">{post.date.month}</div>
                  </div>

                  {/* Category Badge */}
                  <div className="absolute bottom-4 left-4">
                    <span className="inline-block bg-[#32b9e5]/90 backdrop-blur-sm text-white text-xs font-semibold px-3 py-1 rounded-full">
                      {post.category}
                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="p-6">

                  {/* Title */}
                  <h3 className="text-lg font-semibold text-gray-900 mb-3 leading-tight">
                    <a href={post.link} className="hover:text-[#32b9e5] transition-colors">
                      {post.title}
                    </a>
                  </h3>

                  {/* Excerpt */}
                  <p className="text-gray-600 text-sm leading-relaxed mb-6">
                    {post.excerpt}
                  </p>

                  {/* Footer with Author and Read More */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <img
                        src={post.author.avatar}
                        alt={post.author.name}
                        className="w-8 h-8 rounded-full mr-2"
                      />
                      <span className="text-sm text-gray-700">
                        {post.author.name}
                      </span>
                    </div>
                    <a
                      href={post.link}
                      className="text-[#32b9e5] hover:text-[#ec7ec5] transition-colors"
                      aria-label={`Read more about ${post.title}`}
                    >
                      <Icon icon="solar:arrow-right-bold-duotone" className="w-5 h-5" />
                    </a>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NewCharmBlogPosts;