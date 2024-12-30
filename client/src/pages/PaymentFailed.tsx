import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle } from 'lucide-react';
import { useLocation } from 'wouter';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';

export function PaymentFailed() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gray-50">
      <Card className="w-full max-w-md mx-4" role="alert" aria-labelledby="payment-failed-title" aria-describedby="payment-failed-description">
        <CardContent className="pt-6 pb-8">
          <div className="flex flex-col items-center text-center gap-4">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-red-100">
              <AlertCircle className="h-8 w-8 text-red-500" aria-hidden="true" />
            </div>

            <div>
              <h1 id="payment-failed-title" className="text-2xl font-bold text-gray-900 mb-2">
                Payment Failed
              </h1>
              <p id="payment-failed-description" className="text-sm text-gray-600 mb-6">
                We were unable to process your payment. Please try again or use a different payment method.
              </p>
            </div>

            <div className="flex flex-col gap-3 w-full">
              <Button
                onClick={() => setLocation('/')}
                variant="default"
                className="w-full"
              >
                Return to Home
              </Button>
              <Button
                onClick={() => window.location.reload()}
                variant="outline"
                className="w-full"
              >
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default PaymentFailed;