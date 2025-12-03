import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, ArrowRight, RefreshCw } from 'lucide-react';

const EmailVerificationSuccess = () => {
    const [searchParams] = useSearchParams();
    const token = searchParams.get('token');
    const { verifyEmail } = useAuth();
    const navigate = useNavigate();

    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('Verifying your email...');

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Invalid verification link.');
            return;
        }

        const verify = async () => {
            try {
                const result = await verifyEmail(token);
                if (result.success) {
                    setStatus('success');
                    setMessage(result.message || 'Email verified successfully!');
                    // Auto redirect after 3 seconds
                    setTimeout(() => navigate('/login'), 3000);
                } else {
                    setStatus('error');
                    setMessage(result.error || 'Verification failed.');
                }
            } catch (error) {
                setStatus('error');
                setMessage('An unexpected error occurred.');
            }
        };

        verify();
    }, [token, verifyEmail, navigate]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className={`mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-4 ${status === 'success' ? 'bg-green-100 text-green-600' :
                            status === 'error' ? 'bg-red-100 text-red-600' :
                                'bg-blue-100 text-blue-600'
                        }`}>
                        {status === 'success' ? <CheckCircle className="h-6 w-6" /> :
                            status === 'error' ? <XCircle className="h-6 w-6" /> :
                                <RefreshCw className="h-6 w-6 animate-spin" />}
                    </div>
                    <CardTitle className="text-2xl">
                        {status === 'success' ? 'Email Verified' :
                            status === 'error' ? 'Verification Failed' :
                                'Verifying Email'}
                    </CardTitle>
                    <CardDescription>
                        {message}
                    </CardDescription>
                </CardHeader>

                <CardContent className="text-center">
                    {status === 'success' && (
                        <p className="text-sm text-muted-foreground">
                            Redirecting to login in a few seconds...
                        </p>
                    )}
                </CardContent>

                <CardFooter>
                    <Button className="w-full" asChild>
                        <Link to="/login">
                            {status === 'success' ? 'Continue to Login' : 'Back to Login'}
                            <ArrowRight className="ml-2 h-4 w-4" />
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default EmailVerificationSuccess;
