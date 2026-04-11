import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { paymentApi } from '@/services/api';
import { toast } from 'sonner';

const PaymentCallbackPage = () => {
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const reference = searchParams.get('reference');
  const trxref = searchParams.get('trxref');

  useEffect(() => {
    verifyPayment();
  }, []);

  const verifyPayment = async () => {
    try {
      const ref = reference || trxref;
      if (!ref) {
        setStatus('error');
        return;
      }

      await paymentApi.verifyPayment(ref);
      setStatus('success');
      toast.success('Payment successful!');
    } catch (error) {
      setStatus('error');
      toast.error('Payment verification failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Payment Status</CardTitle>
          <CardDescription>
            {status === 'loading' && 'Verifying your payment...'}
            {status === 'success' && 'Your payment was successful!'}
            {status === 'error' && 'Payment failed or was cancelled'}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center">
          {status === 'loading' && (
            <Loader2 className="w-16 h-16 animate-spin text-emerald-500 mb-4" />
          )}
          
          {status === 'success' && (
            <>
              <CheckCircle className="w-16 h-16 text-green-500 mb-4" />
              <p className="text-gray-600 text-center mb-6">
                Your payment has been successfully processed. The artisan has been notified.
              </p>
              <div className="flex gap-4">
                <Link to="/customer/dashboard">
                  <Button className="bg-emerald-500 hover:bg-emerald-600">
                    Go to Dashboard
                  </Button>
                </Link>
              </div>
            </>
          )}
          
          {status === 'error' && (
            <>
              <XCircle className="w-16 h-16 text-red-500 mb-4" />
              <p className="text-gray-600 text-center mb-6">
                We couldn't verify your payment. If you were charged, please contact support.
              </p>
              <div className="flex gap-4">
                <Link to="/customer/dashboard">
                  <Button variant="outline">Go to Dashboard</Button>
                </Link>
                <Link to="/customer/jobs">
                  <Button className="bg-emerald-500 hover:bg-emerald-600">
                    Try Again
                  </Button>
                </Link>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PaymentCallbackPage;
