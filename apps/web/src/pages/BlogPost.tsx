import React, { useEffect } from 'react';
import { useParams, Navigate, NavLink } from 'react-router-dom';
import { LandingNavbar, LandingFooter, SEO, AddToChromeButton } from '../components';
import { getPostBySlug, getRelatedPosts } from '../data/blogData';

const BlogPost: React.FC = () => {
    const { slug } = useParams<{ slug: string }>();
    const post = getPostBySlug(slug || '');

    // Scroll to top on load
    useEffect(() => {
        window.scrollTo(0, 0);
    }, [slug]);

    if (!post) {
        return <Navigate to="/blog" replace />;
    }

    const relatedPosts = getRelatedPosts(post.slug, 3);

    return (
        <div className="min-h-screen bg-white text-slate-900 font-display">
            <SEO
                url={`/blog/${post.slug}`}
                title={post.title}
                description={post.description}
                keywords={post.keywords}
                type="article"
            />
            <LandingNavbar />

            <main className="pt-32 pb-20">
                <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
                    {/* Breadcrumbs */}
                    <nav className="flex text-sm text-slate-500 mb-8" aria-label="Breadcrumb">
                        <ol className="inline-flex items-center space-x-1 md:space-x-3">
                            <li className="inline-flex items-center">
                                <NavLink to="/" className="hover:text-primary transition-colors">Home</NavLink>
                            </li>
                            <li>
                                <div className="flex items-center">
                                    <span className="material-symbols-outlined text-[16px] mx-1">chevron_right</span>
                                    <NavLink to="/blog" className="hover:text-primary transition-colors">Blog</NavLink>
                                </div>
                            </li>
                            <li aria-current="page">
                                <div className="flex items-center">
                                    <span className="material-symbols-outlined text-[16px] mx-1">chevron_right</span>
                                    <span className="text-slate-400 capitalize">{post.category}</span>
                                </div>
                            </li>
                        </ol>
                    </nav>

                    {/* Article Header */}
                    <header className="mb-12 text-center md:text-left">
                        <div className="flex justify-center md:justify-start mb-6">
                            <div className="size-20 rounded-2xl bg-primary/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-primary text-4xl">{post.heroIcon}</span>
                            </div>
                        </div>
                        <h1 className="text-4xl md:text-5xl lg:text-6xl font-black tracking-tight mb-6 leading-tight">
                            {post.title}
                        </h1>
                        <div className="flex flex-wrap items-center justify-center md:justify-start gap-4 text-slate-500">
                            <div className="flex items-center gap-2">
                                <img src="/logo.png" alt="SnapRec Team" className="size-8 rounded-full bg-slate-100" />
                                <span className="font-bold text-slate-700">SnapRec Team</span>
                            </div>
                            <span className="hidden sm:inline text-slate-300">•</span>
                            <time dateTime={post.date}>{new Date(post.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</time>
                            <span className="hidden sm:inline text-slate-300">•</span>
                            <span className="flex items-center gap-1">
                                <span className="material-symbols-outlined text-[18px]">schedule</span>
                                {post.readTime}
                            </span>
                        </div>
                    </header>

                    {/* Article Content */}
                    <div
                        className="prose prose-lg prose-slate max-w-none 
                                    prose-headings:font-black prose-headings:tracking-tight 
                                    prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-6
                                    prose-h3:text-2xl prose-h3:mt-8 
                                    prose-a:text-primary prose-a:no-underline hover:prose-a:underline
                                    prose-li:marker:text-primary
                                    prose-img:rounded-2xl prose-img:shadow-lg
                                    prose-strong:font-bold prose-strong:text-slate-900"
                        dangerouslySetInnerHTML={{ __html: post.content }}
                    />

                    {/* Article Footer CTA */}
                    <div className="mt-16 bg-gradient-to-br from-indigo-50 to-blue-50 border border-blue-100 rounded-3xl p-8 md:p-12 text-center">
                        <div className="size-16 bg-white rounded-2xl shadow-sm flex items-center justify-center mx-auto mb-6">
                            <img src="/logo.png" alt="SnapRec" className="size-8" />
                        </div>
                        <h3 className="text-2xl font-black mb-4">Start Recording for Free</h3>
                        <p className="text-slate-600 mb-8 max-w-xl mx-auto">
                            Join thousands of creators, educators, and teams who use SnapRec to capture their screens effortlessly. No watermarks, no time limits.
                        </p>
                        <div className="flex justify-center">
                            <AddToChromeButton size="lg" />
                        </div>
                    </div>
                </article>

                {/* Related Posts */}
                {relatedPosts.length > 0 && (
                    <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 mt-24">
                        <h3 className="text-2xl font-black mb-8">Related Articles</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {relatedPosts.map((related) => (
                                <NavLink
                                    key={related.slug}
                                    to={`/blog/${related.slug}`}
                                    className="group block"
                                >
                                    <div className="bg-white rounded-2xl border border-slate-200 p-6 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 h-full flex flex-col">
                                        <div className="flex items-start gap-4 mb-4">
                                            <div className="flex-shrink-0 size-12 rounded-xl bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                                                <span className="material-symbols-outlined text-primary text-2xl">{related.heroIcon}</span>
                                            </div>
                                            <div className="flex flex-col gap-1">
                                                <span className="text-[10px] uppercase font-bold text-primary tracking-wider">
                                                    {related.category}
                                                </span>
                                                <span className="text-slate-400 text-xs">{related.readTime}</span>
                                            </div>
                                        </div>
                                        <h4 className="text-lg font-bold mb-3 group-hover:text-primary transition-colors leading-tight">
                                            {related.title}
                                        </h4>
                                    </div>
                                </NavLink>
                            ))}
                        </div>
                    </section>
                )}
            </main>

            <LandingFooter />
        </div>
    );
};

export default BlogPost;
