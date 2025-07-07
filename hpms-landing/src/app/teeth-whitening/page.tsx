import { Metadata } from 'next';
import Link from 'next/link';
import { Icon } from '@iconify/react';

export const metadata: Metadata = {
  title: 'Teeth Whitening Windhoek | NewCharm Dental Practice',
  description: 'Professional teeth whitening in Windhoek. Get a brighter, whiter smile with our advanced whitening treatments. Safe, effective, and long-lasting results.',
  keywords: 'teeth whitening windhoek, dental bleaching namibia, white teeth, cosmetic dentistry windhoek',
};

export default function TeethWhiteningPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Quick Nav */}
      <nav className="bg-white shadow-md sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <Link href="/" className="text-2xl font-bold text-[#32b9e5]">
            NewCharm Dental
          </Link>
          <Link href="/#contact" className="bg-[#32b9e5] text-white px-6 py-2 rounded-full">
            Book Appointment
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="py-20 bg-gradient-to-br from-blue-50 to-white">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-6">
                Professional Teeth Whitening in Windhoek
              </h1>
              <p className="text-xl text-gray-600 mb-8">
                Transform your smile with our advanced teeth whitening treatments. 
                Safe, effective, and performed by dental professionals.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/#contact" className="bg-[#32b9e5] text-white px-8 py-4 rounded-full text-center font-semibold">
                  Get Started Today
                </Link>
                <Link href="tel:+264612345678" className="border-2 border-[#32b9e5] text-[#32b9e5] px-8 py-4 rounded-full text-center font-semibold">
                  Call: +264 61 234 5678
                </Link>
              </div>
            </div>
            <div>
              <img 
                src="https://images.unsplash.com/photo-1606811841689-23dfddce3e95?w=600&h=400&fit=crop" 
                alt="Professional teeth whitening treatment at NewCharm Dental"
                className="rounded-2xl shadow-xl"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Why Choose Our Teeth Whitening?</h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <Icon icon="solar:shield-check-bold-duotone" className="w-16 h-16 text-[#32b9e5] mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Safe & Professional</h3>
              <p className="text-gray-600">Performed by qualified dental professionals using approved methods</p>
            </div>
            <div className="text-center">
              <Icon icon="solar:clock-circle-bold-duotone" className="w-16 h-16 text-[#32b9e5] mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Quick Results</h3>
              <p className="text-gray-600">See noticeable results in just one session</p>
            </div>
            <div className="text-center">
              <Icon icon="solar:star-shine-bold-duotone" className="w-16 h-16 text-[#32b9e5] mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Long-Lasting</h3>
              <p className="text-gray-600">Enjoy your brighter smile for months with proper care</p>
            </div>
          </div>
        </div>
      </section>

      {/* Process Section */}
      <section className="py-16 bg-gray-50">
        <div className="container mx-auto px-4">
          <h2 className="text-3xl font-bold text-center mb-12">Our Whitening Process</h2>
          <div className="max-w-3xl mx-auto">
            <div className="space-y-6">
              <div className="flex items-start space-x-4">
                <div className="bg-[#32b9e5] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">1</div>
                <div>
                  <h3 className="font-semibold text-lg">Consultation & Examination</h3>
                  <p className="text-gray-600">We assess your teeth and discuss your whitening goals</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="bg-[#32b9e5] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">2</div>
                <div>
                  <h3 className="font-semibold text-lg">Professional Cleaning</h3>
                  <p className="text-gray-600">Remove plaque and tartar for optimal results</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="bg-[#32b9e5] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">3</div>
                <div>
                  <h3 className="font-semibold text-lg">Whitening Treatment</h3>
                  <p className="text-gray-600">Apply professional-grade whitening gel with LED activation</p>
                </div>
              </div>
              <div className="flex items-start space-x-4">
                <div className="bg-[#32b9e5] text-white w-8 h-8 rounded-full flex items-center justify-center font-bold">4</div>
                <div>
                  <h3 className="font-semibold text-lg">Aftercare Instructions</h3>
                  <p className="text-gray-600">Guidance on maintaining your bright new smile</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-[#32b9e5] text-white">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready for a Brighter Smile?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Book your teeth whitening consultation today
          </p>
          <Link 
            href="/#contact" 
            className="bg-white text-[#32b9e5] px-8 py-4 rounded-full font-semibold inline-block hover:shadow-lg transition-shadow"
          >
            Schedule Your Appointment
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-gray-900 text-white text-center">
        <p>&copy; 2024 NewCharm Dental Practice. All rights reserved.</p>
        <Link href="/" className="text-[#32b9e5] hover:underline">
          Back to Home
        </Link>
      </footer>
    </div>
  );
}