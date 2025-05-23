import React from 'react';
import { useNavigate } from 'react-router-dom';
import Button from '../components/ui/Button';
import { ChevronLeft, Home } from 'lucide-react';

const NotFound: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4 animate-fade-in">
      <h1 className="text-9xl font-bold text-primary-400">404</h1>
      <h2 className="text-3xl font-bold text-gray-900 mt-4">Page not found</h2>
      <p className="text-gray-600 mt-2 max-w-md">
        The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 mt-8">
        <Button
          onClick={() => navigate(-1)}
          variant="outline"
        >
          <ChevronLeft size={16} className="mr-2" />
          Go Back
        </Button>
        <Button
          onClick={() => navigate('/')}
        >
          <Home size={16} className="mr-2" />
          Return Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;