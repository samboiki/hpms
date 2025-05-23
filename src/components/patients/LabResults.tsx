import React from 'react';
import { 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  AlertCircle,
  Download,
  Search,
  Filter
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';

interface LabResult {
  id: string;
  date: string;
  category: string;
  name: string;
  value: number;
  unit: string;
  referenceRange: string;
  status: 'normal' | 'high' | 'low' | 'critical';
  orderedBy: string;
  notes?: string;
}

interface LabResultsProps {
  results: LabResult[];
}

const LabResults: React.FC<LabResultsProps> = ({ results }) => {
  // Group results by category
  const groupedResults = results.reduce((acc, result) => {
    if (!acc[result.category]) {
      acc[result.category] = [];
    }
    acc[result.category].push(result);
    return acc;
  }, {} as Record<string, LabResult[]>);

  const getStatusColor = (status: LabResult['status']) => {
    switch (status) {
      case 'normal':
        return 'text-success-600';
      case 'high':
        return 'text-warning-600';
      case 'low':
        return 'text-brand-primary';
      case 'critical':
        return 'text-error-600';
      default:
        return 'text-gray-600';
    }
  };

  const getStatusIcon = (status: LabResult['status']) => {
    switch (status) {
      case 'normal':
        return null;
      case 'high':
        return <TrendingUp size={14} className="ml-1" />;
      case 'low':
        return <TrendingDown size={14} className="ml-1" />;
      case 'critical':
        return <AlertCircle size={14} className="ml-1" />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      {/* Search and Filter */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
              <input
                type="text"
                placeholder="Search lab results..."
                className="pl-10 pr-4 py-2 w-full rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary"
              />
            </div>
            <div className="flex gap-3">
              <select className="px-4 py-2 rounded-md border border-gray-300 focus:ring-brand-primary focus:border-brand-primary">
                <option value="">All Categories</option>
                {Object.keys(groupedResults).map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
              <Button variant="outline">
                <Filter size={16} className="mr-2" />
                Filter
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results by Category */}
      {Object.entries(groupedResults).map(([category, categoryResults]) => (
        <Card key={category}>
          <CardHeader>
            <div className="flex justify-between items-center">
              <CardTitle>{category}</CardTitle>
              <Button variant="outline" size="sm">
                <Download size={14} className="mr-2" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="text-xs uppercase text-gray-500 border-b border-gray-200">
                    <th className="px-4 py-3 text-left">Test</th>
                    <th className="px-4 py-3 text-left">Result</th>
                    <th className="px-4 py-3 text-left">Reference Range</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Date</th>
                    <th className="px-4 py-3 text-left">Ordered By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {categoryResults.map((result) => (
                    <tr key={result.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-medium text-gray-900">{result.name}</p>
                          {result.notes && (
                            <p className="text-xs text-gray-500 mt-1">{result.notes}</p>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="font-medium text-gray-900">
                          {result.value} {result.unit}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">
                          {result.referenceRange}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className={`flex items-center ${getStatusColor(result.status)}`}>
                          <Badge
                            variant={
                              result.status === 'normal' ? 'success' :
                              result.status === 'high' ? 'warning' :
                              result.status === 'low' ? 'azure' :
                              'error'
                            }
                            size="sm"
                          >
                            <span className="flex items-center">
                              {result.status}
                              {getStatusIcon(result.status)}
                            </span>
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{result.date}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-600">{result.orderedBy}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      ))}

      {Object.keys(groupedResults).length === 0 && (
        <div className="text-center py-8">
          <FileText size={40} className="mx-auto text-gray-300" />
          <p className="mt-2 text-gray-500">No lab results available</p>
        </div>
      )}
    </div>
  );
};

export default LabResults;