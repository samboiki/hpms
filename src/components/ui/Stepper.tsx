import React from 'react';
import { motion } from 'framer-motion';
import { Icon } from '@iconify/react';
import { cn } from '../../utils/cn';

interface Step {
  id: string;
  label: string;
  description?: string;
  icon?: string;
}

interface StepperProps {
  steps: Step[];
  currentStep: number;
  onStepClick?: (stepIndex: number) => void;
  className?: string;
  variant?: 'default' | 'embedded';
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: 'primary' | 'neutral';
}

export const Stepper: React.FC<StepperProps> = ({
  steps,
  currentStep,
  onStepClick,
  className,
  variant = 'default',
  size = 'md',
  colorScheme = 'primary'
}) => {
  const sizes = {
    sm: {
      circle: 'w-8 h-8',
      icon: 'w-4 h-4',
      text: 'text-xs',
      connector: 'h-0.5',
      gap: 'gap-2'
    },
    md: {
      circle: 'w-10 h-10',
      icon: 'w-5 h-5',
      text: 'text-sm',
      connector: 'h-0.5',
      gap: 'gap-3'
    },
    lg: {
      circle: 'w-12 h-12',
      icon: 'w-6 h-6',
      text: 'text-base',
      connector: 'h-1',
      gap: 'gap-4'
    }
  };

  const colors = {
    primary: {
      completed: 'bg-[#11859d] border-[#11859d] text-white',
      current: 'bg-amber-500 border-amber-500 text-white',
      pending: 'bg-white border-gray-300 text-gray-400',
      connector: {
        completed: 'bg-[#11859d]',
        pending: 'bg-gray-300'
      }
    },
    neutral: {
      completed: 'bg-gray-900 border-gray-900 text-white',
      current: 'bg-gray-700 border-gray-700 text-white',
      pending: 'bg-white border-gray-300 text-gray-400',
      connector: {
        completed: 'bg-gray-900',
        pending: 'bg-gray-300'
      }
    }
  };

  const currentSize = sizes[size];
  const currentColors = colors[colorScheme];

  return (
    <div 
      className={cn(
        'w-full',
        variant === 'embedded' && 'bg-transparent',
        className
      )}
    >
      <div className="relative">
        {/* Steps Container */}
        <div className="relative flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              {/* Step */}
              <div className="relative flex flex-col items-center">
                <motion.button
                  onClick={() => onStepClick?.(index)}
                  disabled={!onStepClick || index > currentStep}
                  className={cn(
                    'relative z-10 rounded-full flex items-center justify-center font-semibold transition-all duration-300 border-2 shadow-sm',
                    currentSize.circle,
                    currentStep > index 
                      ? currentColors.completed + ' shadow-md'
                      : currentStep === index 
                      ? currentColors.current + ' shadow-lg'
                      : currentColors.pending,
                    onStepClick && index <= currentStep && 'cursor-pointer hover:scale-110 hover:shadow-lg',
                    (!onStepClick || index > currentStep) && 'cursor-default'
                  )}
                  initial={false}
                  animate={{
                    scale: currentStep === index ? [1, 1.1, 1] : 1,
                    boxShadow: currentStep === index 
                      ? ['0 4px 6px -1px rgba(0, 0, 0, 0.1)', '0 10px 15px -3px rgba(0, 0, 0, 0.1)', '0 4px 6px -1px rgba(0, 0, 0, 0.1)']
                      : '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
                  }}
                  transition={{
                    duration: currentStep === index ? 2 : 0.3,
                    repeat: currentStep === index ? Infinity : 0,
                    ease: "easeInOut"
                  }}
                  whileHover={onStepClick && index <= currentStep ? { scale: 1.1 } : {}}
                  whileTap={onStepClick && index <= currentStep ? { scale: 0.95 } : {}}
                >
                  {currentStep > index ? (
                    step.icon ? (
                      <Icon icon={step.icon} className={cn(currentSize.icon, "text-white")} />
                    ) : (
                      <Icon icon="solar:check-bold" className={cn(currentSize.icon, "text-white")} />
                    )
                  ) : step.icon ? (
                    <Icon icon={step.icon} className={currentSize.icon} />
                  ) : (
                    <span className={currentSize.text}>{index + 1}</span>
                  )}
                </motion.button>

                {/* Label */}
                {variant !== 'embedded' && (
                  <div className={cn('absolute top-full mt-2 text-center', currentSize.gap)}>
                    <p className={cn(
                      'font-medium whitespace-nowrap',
                      currentSize.text,
                      currentStep >= index ? 'text-gray-900' : 'text-gray-400'
                    )}>
                      {step.label}
                    </p>
                    {step.description && size !== 'sm' && (
                      <p className="text-xs text-gray-500 mt-0.5 max-w-[100px]">
                        {step.description}
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Connector */}
              {index < steps.length - 1 && (
                <div className="flex-1 px-2">
                  <div className={cn(
                    'relative overflow-hidden rounded-full',
                    currentSize.connector,
                    currentColors.connector.pending
                  )}>
                    <motion.div
                      className={cn(
                        'absolute inset-0',
                        currentColors.connector.completed
                      )}
                      initial={{ width: '0%' }}
                      animate={{ width: currentStep > index ? '100%' : '0%' }}
                      transition={{ duration: 0.3, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Embedded Labels */}
        {variant === 'embedded' && (
          <div className="flex justify-between mt-3">
            {steps.map((step, index) => (
              <div 
                key={step.id} 
                className={cn(
                  'text-center',
                  index === 0 && 'text-left',
                  index === steps.length - 1 && 'text-right'
                )}
              >
                <p className={cn(
                  'font-medium',
                  currentSize.text,
                  currentStep >= index ? 'text-gray-900' : 'text-gray-400'
                )}>
                  {step.label}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// Mini stepper for tight spaces
export const MiniStepper: React.FC<{
  steps: number;
  currentStep: number;
  className?: string;
}> = ({ steps, currentStep, className }) => {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {Array.from({ length: steps }).map((_, index) => (
        <div
          key={index}
          className={cn(
            'h-1.5 rounded-full transition-all duration-200',
            index < currentStep ? 'w-6 bg-amber-500' : 
            index === currentStep ? 'w-8 bg-amber-500' : 
            'w-1.5 bg-gray-300'
          )}
        />
      ))}
    </div>
  );
};

export default Stepper;