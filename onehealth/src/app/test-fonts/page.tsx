'use client'

export default function TestFontsPage() {
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Headers Test - Should use Poppins */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h1 className="text-3xl font-poppins font-bold text-gray-900 mb-4">
            H1 Header - Poppins Font Test
          </h1>
          <h2 className="text-2xl font-poppins font-semibold text-gray-800 mb-3">
            H2 Header - Poppins Font Test
          </h2>
          <h3 className="text-xl font-poppins font-medium text-gray-700 mb-2">
            H3 Header - Poppins Font Test
          </h3>
        </div>

        {/* Body Text Test - Should use Montserrat */}
        <div className="bg-white p-6 rounded-lg shadow">
          <p className="text-base font-montserrat text-gray-600 mb-4">
            This is body text using Montserrat font. It should appear clean and readable 
            for healthcare professionals. This paragraph tests the readability and 
            appearance of Montserrat for general content.
          </p>
          <p className="text-sm font-montserrat text-gray-500 mb-2">
            Small text using Montserrat - perfect for descriptions and details.
          </p>
          <p className="text-lg font-montserrat text-gray-700">
            Large body text using Montserrat - great for important information.
          </p>
        </div>

        {/* Mixed Typography Test */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-poppins font-bold text-onehealth-600 mb-4">
            OneHealth Practice Management
          </h2>
          <p className="text-base font-montserrat text-gray-600 mb-4">
            Welcome to the OneHealth admin portal. This system manages healthcare 
            practices across Namibia with premium typography and professional design.
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
            <div className="p-4 bg-onehealth-50 rounded">
              <h3 className="text-lg font-poppins font-semibold text-onehealth-800 mb-2">
                Practices
              </h3>
              <p className="text-sm font-montserrat text-onehealth-600">
                Manage all healthcare practices
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded">
              <h3 className="text-lg font-poppins font-semibold text-blue-800 mb-2">
                SMS Management
              </h3>
              <p className="text-sm font-montserrat text-blue-600">
                Monitor SMS communications
              </p>
            </div>
          </div>
        </div>

        {/* Font Inspector */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-2xl font-poppins font-bold text-gray-900 mb-4">
            Font Inspector
          </h2>
          <div className="space-y-3">
            <div className="p-3 bg-gray-100 rounded">
              <h4 className="font-poppins font-medium mb-1">font-poppins class:</h4>
              <p className="font-montserrat text-sm text-gray-600">Applied to: h1, h2, h3, headers</p>
            </div>
            <div className="p-3 bg-gray-100 rounded">
              <h4 className="font-poppins font-medium mb-1">font-montserrat class:</h4>
              <p className="font-montserrat text-sm text-gray-600">Applied to: p, body text, descriptions</p>
            </div>
          </div>
        </div>

        {/* Debug Info */}
        <div className="bg-gray-100 p-4 rounded-lg text-xs font-montserrat text-gray-500">
          Debug: If you can see different fonts above, the configuration is working correctly.
          Poppins should be more geometric and modern for headers, 
          Montserrat should be more humanist and readable for body text.
        </div>
      </div>
    </div>
  )
}