import React from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout, PricingTable, SEO } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { useSubscription, useStartCheckout } from '../hooks/useSubscription';

const Pricing: React.FC = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const { data: sub } = useSubscription(!!user);
    const startCheckout = useStartCheckout();

    const isProActive = sub?.plan === 'pro' && sub?.status === 'active';

    const handleUpgrade = () => {
        if (!user) {
            navigate('/login?next=/pricing');
            return;
        }
        startCheckout.mutate({});
    };

    return (
        <MainLayout>
            <SEO
                title="Pricing — SnapRec"
                description="SnapRec Pro adds AI transcription, summaries, action items, and chapters to your recordings. $19/month."
                url="/pricing"
            />
            <div className="bg-background-light dark:bg-background-dark min-h-screen py-16 px-6">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-12">
                        <h1 className="text-4xl md:text-5xl font-black text-slate-900 dark:text-white tracking-tight mb-4">
                            Record meetings. Get an AI summary.
                        </h1>
                        <p className="text-lg text-slate-500 dark:text-slate-400 max-w-2xl mx-auto">
                            No bot joins your call. You control the recording. Your audio stays private until you press stop.
                        </p>
                    </div>
                    <PricingTable
                        onSelectPro={handleUpgrade}
                        isProActive={isProActive}
                        isLoading={startCheckout.isPending}
                    />
                    <div className="mt-16 max-w-2xl mx-auto text-slate-500 dark:text-slate-400 space-y-6 text-sm">
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white mb-2">How does the AI summary work?</h3>
                            <p>
                                After your recording uploads, SnapRec transcribes the audio (OpenAI Whisper) and generates a
                                summary, action items, and chapters with Claude. You see the result in your share page within
                                a couple of minutes.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white mb-2">Is my audio used to train AI models?</h3>
                            <p>No — both OpenAI's and Anthropic's API tiers exclude data from training by default.</p>
                        </div>
                        <div>
                            <h3 className="font-bold text-slate-900 dark:text-white mb-2">Can I cancel anytime?</h3>
                            <p>Yes. Cancel from Settings → Billing. Your existing transcripts and summaries stay accessible.</p>
                        </div>
                    </div>
                </div>
            </div>
        </MainLayout>
    );
};

export default Pricing;
