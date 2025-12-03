import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Mail, ArrowLeft, RefreshCw, CheckCircle } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

const EmailVerificationPending = () => {
    const { resendVerificationEmail } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const { toast } = useToast();

    const [email, setEmail] = useState<string>('');
    const [isResending, setIsResending] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        // Get email from location state or local storage
        const stateEmail = location.state?.email;
        if (stateEmail) {
            setEmail(stateEmail);
        } else {
            // Try to get from user object if logged in (but unverified)
            // or redirect to login if no email found
            // navigate('/login');
        }
    }, [location, navigate]);

    useEffect(() => {
        let timer: NodeJS.Timeout;
        if (countdown > 0) {
            timer = setTimeout(() => setCountdown(c => c - 1), 1000);
        }
        return () => clearTimeout(timer);
    }, [countdown]);

    const handleResend = async () => {
        if (!email) return;

        setIsResending(true);
        try {
            const result = await resendVerificationEmail(email);

            if (result.success) {
                toast({
                    title: "Email Sent",
                    description: "A new verification email has been sent to your inbox.",
                });
                setCountdown(60); // 60 seconds cooldown
            } else {
                toast({
                    variant: "destructive",
                    title: "Error",
                    description: result.error || "Failed to send verification email.",
                });

                if (result.error?.includes('wait')) {
                    setCountdown(60);
                }
            }
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "An unexpected error occurred.",
            });
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-background p-4">
            <Card className="w-full max-w-md">
                <CardHeader className="text-center">
                    <div className="mx-auto w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                        <Mail className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle className="text-2xl">Check your email</CardTitle>
                    <CardDescription>
                        We've sent a verification link to <span className="font-medium text-foreground">{email}</span>
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4 text-center">
                    <p className="text-sm text-muted-foreground">
                        Click the link in the email to verify your account and access all features of LegalPro.
                    </p>
                    <p className="text-xs text-muted-foreground">
                        The link will expire in 24 hours.
                    </p>
                </CardContent>
                <CardFooter className="flex flex-col space-y-4">
                    <Button
                        variant="outline"
                        className="w-full"
                        onClick={handleResend}
                        disabled={isResending || countdown > 0}
                    >
                        {isResending ? (
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                            <Mail className="mr-2 h-4 w-4" />
                        )}
                        {countdown > 0 ? `Resend in ${countdown}s` : 'Resend Verification Email'}
                    </Button>

                    <Button variant="ghost" className="w-full" asChild>
                        <Link to="/login">
                            <ArrowLeft className="mr-2 h-4 w-4" />
                            Back to Login
                        </Link>
                    </Button>
                </CardFooter>
            </Card>
        </div>
    );
};

export default EmailVerificationPending;
