import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, SEO, AddToChromeButton } from '../components';
import { blogPosts, categories } from '../data/blogData';

const categoryStyles: Record<string, { bg: string; text: string }> = {
    tutorial: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-300' },
    comparison: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-700 dark:text-purple-300' },
    tips: { bg: 'bg-amber-100 dark:bg-amber-900/30', text: 'text-amber-700 dark:text-amber-300' },
};

const Blog: React.FC = () => {
    const [activeCategory, setActiveCategory] = useState<string>('all');

    const filtered = activeCategory === 'all'
        ? blogPosts
        : blogPosts.filter((p) => p.category === activeCategory);

    const [featured, ...rest] = filtered;

    return (
        <div className="min-h-screen bg-white text-slate-900 font-display">
            <SEO
                url="/blog"
                title="Blog — Screen Recording Tips, Tutorials & Comparisons"
                description="Learn how to record your screen, take full-page screenshots, and boost productivity. Free tutorials, tool comparisons, and expert tips from the SnapRec team."
                keywords="screen recorder blog, screen recording tips, screenshot tutorial, how to record screen, free screen recorder guide, chrome extension tips"
                jsonLd={{
                    '@context': 'https://schema.org',
                    '@graph': [
                        {
                            '@type': 'CollectionPage',
                            name: 'SnapRec Blog — Screen Recording Tips, Tutorials & Comparisons',
                            description: 'Learn how to record your screen, take full-page screenshots, and boost productivity. Free tutorials, tool comparisons, and expert tips from the SnapRec team.',
                            url: 'https://www.snaprecorder.org/blog',
                            publisher: { '@type': 'Organization', name: 'SnapRec', url: 'https://www.snaprecorder.org' },
                        },
                        {
                            '@type': 'BreadcrumbList',
                            itemListElement: [
                                { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.snaprecorder.org/' },
                                { '@type': 'ListItem', position: 2, name: 'Blog' },
                            ],
                        },
                    ],
                }}
            />
            <LandingNavbar />

            <main className="pt-32 pb-20">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Header */}
                    <div className="text-center mb-14">
                        <h1 className="text-5xl md:text-6xl font-black tracking-tight mb-4">
                            The SnapRec{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-purple-600">
                                Blog
                            </span>
                        </h1>
                        <p className="text-slate-500 text-lg max-w-2xl mx-auto">
                            Tutorials, comparisons, and tips to help you capture and share your screen like a pro.
                        </p>
                    </div>

                    {/* Category Filters */}
                    <div className="flex flex-wrap justify-center gap-3 mb-12">
                        {categories.map((cat) => (
                            <button
                                key={cat.key}
                                onClick={() => setActiveCategory(cat.key)}
                                className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all duration-200 ${activeCategory === cat.key
                                        ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                    }`}
                            >
                                <span className="material-symbols-outlined text-[18px]">{cat.icon}</span>
                                {cat.label}
                            </button>
                        ))}
                    </div>

                    {/* Featured Post */}
                    {featured && (
                        <NavLink
                            to={`/blog/${featured.slug}`}
                            className="block group mb-12"
                        >
                            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-3xl border border-slate-200 p-8 md:p-12 hover:shadow-2xl hover:-translate-y-1 transition-all duration-500 relative overflow-hidden">
                                <div className="absolute -top-20 -right-20 size-60 bg-primary/5 rounded-full blur-3xl"></div>
                                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-center">
                                    <div className="flex-shrink-0 size-24 md:size-32 rounded-2xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-500">
                                        <span className="material-symbols-outlined text-primary text-5xl md:text-6xl">{featured.heroIcon}</span>
                                    </div>
                                    <div className="flex-1 text-center md:text-left">
                                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-3">
                                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${categoryStyles[featured.category]?.bg} ${categoryStyles[featured.category]?.text}`}>
                                                {featured.category}
                                            </span>
                                            <span className="text-slate-400 text-sm">{featured.date}</span>
                                            <span className="text-slate-400 text-sm">· {featured.readTime}</span>
                                        </div>
                                        <h2 className="text-2xl md:text-3xl font-black mb-3 group-hover:text-primary transition-colors">
                                            {featured.title}
                                        </h2>
                                        <p className="text-slate-500 text-lg leading-relaxed">
                                            {featured.description}
                                        </p>
                                        <span className="inline-flex items-center gap-2 mt-4 text-primary font-bold group-hover:gap-3 transition-all">
                                            Read Article
                                            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </NavLink>
                    )}

                    {/* Post Grid */}
                    {rest.length > 0 && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {rest.map((post) => (
                                <NavLink
                                    key={post.slug}
                                    to={`/blog/${post.slug}`}
                                    className="group block"
                                >
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 md:p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="flex-shrink-0 size-14 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <span className="material-symbols-outlined text-primary text-3xl">{post.heroIcon}</span>
                                            </div>
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${categoryStyles[post.category]?.bg} ${categoryStyles[post.category]?.text}`}>
                                                    {post.category}
                                                </span>
                                                <span className="text-slate-400 text-xs">{post.readTime}</span>
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-black mb-3 group-hover:text-primary transition-colors leading-tight">
                                            {post.title}
                                        </h3>
                                        <p className="text-slate-500 text-sm leading-relaxed flex-1">
                                            {post.description}
                                        </p>
                                        <span className="inline-flex items-center gap-2 mt-4 text-primary font-bold text-sm group-hover:gap-3 transition-all">
                                            Read More
                                            <span className="material-symbols-outlined text-[16px]">arrow_forward</span>
                                        </span>
                                    </div>
                                </NavLink>
                            ))}
                        </div>
                    )}

                    {filtered.length === 0 && (
                        <div className="text-center py-20 text-slate-400">
                            <span className="material-symbols-outlined text-5xl mb-4 block">article</span>
                            <p className="text-lg font-bold">No posts in this category yet.</p>
                        </div>
                    )}

                    {/* Bottom CTA */}
                    <section className="mt-20">
                        <div className="bg-slate-900 rounded-3xl p-10 md:p-16 text-center relative overflow-hidden">
                            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 rounded-full blur-[100px] -translate-y-1/2 translate-x-1/2"></div>
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-4 relative">
                                Ready to start recording?
                            </h2>
                            <p className="text-slate-400 text-lg mb-8 max-w-xl mx-auto">
                                Join thousands of users capturing their screens with SnapRec — 100% free, no watermarks, no limits.
                            </p>
                            <div className="flex justify-center">
                                <AddToChromeButton variant="white" size="lg" />
                            </div>
                        </div>
                    </section>
                </div>
            </main>

            <LandingFooter />
        </div>
    );
};

export default Blog;
