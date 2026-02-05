import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "../contexts/LanguageContext";
import "./LandingPage.css";

// Declare AOS and bootstrap for TypeScript
declare const AOS: any;
declare const bootstrap: any;

const LandingPage = () => {
    const navigate = useNavigate();
    const { currentLang, setLanguage, t } = useLanguage();
    const [scrolled, setScrolled] = useState(false);

    useEffect(() => {
        // Initialize AOS
        if (typeof AOS !== 'undefined') {
            AOS.init({
                duration: 800,
                once: true,
                offset: 100
            });
        }

        // Navbar scroll effect
        const handleScroll = () => {
            if (window.scrollY > 50) {
                setScrolled(true);
            } else {
                setScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const handleLanguageChange = (lang: any) => {
        setLanguage(lang);
    };

    // handleLogin removed as we redirect now

    return (
        <div className="landing-page">
            {/* Navigation */}
            <nav className={`navbar navbar-expand-lg fixed-top ${scrolled ? 'scrolled' : ''}`} style={{ background: 'white', borderBottom: '1px solid #eee' }}>
                <div className="container d-flex justify-content-between align-items-center">
                    <a className="navbar-brand fw-bold text-primary d-flex align-items-center gap-2" onClick={() => navigate('/')} style={{ cursor: 'pointer', fontSize: '1.5rem', margin: 0 }}>
                        <img src="/logo.ico" alt="Logo" style={{ height: '32px', width: '32px' }} />
                        <span>{t('nav_brand')}</span>
                    </a>

                    <div className="d-flex align-items-center">
                        <ul className="navbar-nav d-none d-lg-flex flex-row align-items-center list-unstyled mb-0">
                            <li><a className="nav-link text-dark fw-medium px-3" href="#home">{t('nav_home')}</a></li>
                            <li><a className="nav-link text-dark fw-medium px-3" href="#about">{t('nav_about')}</a></li>
                            <li><a className="nav-link text-dark fw-medium px-3" href="#services">{t('nav_services')}</a></li>
                            <li><a className="nav-link text-dark fw-medium px-3" href="#contact">{t('nav_contact')}</a></li>
                        </ul>

                        <div className="dropdown mx-2">
                            <button className="btn btn-outline-secondary dropdown-toggle btn-sm rounded-pill" type="button" data-bs-toggle="dropdown">
                                <i className="bi bi-globe me-1"></i> {currentLang.toUpperCase()}
                            </button>
                            <ul className="dropdown-menu dropdown-menu-end shadow border-0">
                                <li><button className="dropdown-item" onClick={() => handleLanguageChange('en')}>English</button></li>
                                <li><button className="dropdown-item" onClick={() => handleLanguageChange('fr')}>Français</button></li>
                                <li><button className="dropdown-item" onClick={() => handleLanguageChange('ar')}>العربية</button></li>
                            </ul>
                        </div>

                        <button
                            onClick={() => navigate('/login')}
                            className="btn btn-primary rounded-pill px-4 fw-bold shadow-sm"
                            style={{ background: 'var(--primary-color)', border: 'none', marginLeft: '10px' }}
                        >
                            {t('nav_login')}
                        </button>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section id="home" className="hero">
                <div className="container">
                    <div className="row align-items-center">
                        <div className={`col-lg-6 ${currentLang === 'ar' ? 'order-lg-2' : ''}`}>
                            <div className="hero-content" data-aos="fade-up">
                                <h1>{t('hero_title')}</h1>
                                <p>{t('hero_subtitle')}</p>
                                <div className="hero-buttons">
                                    <a onClick={() => navigate('/login')} className="btn-hero" style={{ cursor: 'pointer' }}>{t('hero_btn_primary')}</a>
                                    <a href="#about" className="btn-hero-outline">{t('hero_btn_secondary')}</a>
                                </div>
                            </div>
                        </div>
                        <div className={`col-lg-6 ${currentLang === 'ar' ? 'order-lg-1' : ''}`} data-aos="fade-left">
                            <div className="text-center">
                                <div className="hero-image" style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '20px', padding: '3rem', backdropFilter: 'blur(10px)' }}>
                                    <i className="bi bi-bar-chart-line" style={{ fontSize: '8rem', color: 'var(--secondary-color)' }}></i>
                                    <div className="mt-3">
                                        <h4 className="text-white">{t('hero_data_driven')}</h4>
                                        <p className="text-white-50">{t('hero_real_time')}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section className="section">
                <div className="container">
                    <div className="row">
                        <div className="col-12">
                            <h2 className="section-title">{t('features_title')}</h2>
                            <p className="section-subtitle">{t('features_subtitle')}</p>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-lg-4 col-md-6 mb-4" data-aos="fade-up" data-aos-delay="100">
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <i className="bi bi-speedometer2"></i>
                                </div>
                                <h4>{t('feature_1_title')}</h4>
                                <p>{t('feature_1_desc')}</p>
                            </div>
                        </div>
                        <div className="col-lg-4 col-md-6 mb-4" data-aos="fade-up" data-aos-delay="200">
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <i className="bi bi-map"></i>
                                </div>
                                <h4>{t('feature_2_title')}</h4>
                                <p>{t('feature_2_desc')}</p>
                            </div>
                        </div>
                        <div className="col-lg-4 col-md-6 mb-4" data-aos="fade-up" data-aos-delay="300">
                            <div className="feature-card">
                                <div className="feature-icon">
                                    <i className="bi bi-graph-up-arrow"></i>
                                </div>
                                <h4>{t('feature_3_title')}</h4>
                                <p>{t('feature_3_desc')}</p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* About Section */}
            <section id="about" className="section about-bg">
                <div className="container">
                    <div className="row align-items-center">
                        <div className={`col-lg-6 ${currentLang === 'ar' ? 'order-lg-2' : ''}`} data-aos="fade-right">
                            <div className="about-image">
                                <div style={{ background: 'linear-gradient(135deg, var(--primary-color), var(--dark-blue))', height: '400px', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderRadius: '20px', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}>
                                    <img src="/INSEED.jpeg" alt="INSEED Headquarters" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'brightness(1.1) contrast(1.05)' }} />
                                </div>
                            </div>
                        </div>
                        <div className={`col-lg-6 ${currentLang === 'ar' ? 'order-lg-1' : ''}`} data-aos="fade-left">
                            <div className="ps-lg-4">
                                <h2 className="section-title text-start mb-4">{t('about_title')}</h2>
                                <p className="mb-4">{t('about_desc_1')}</p>
                                <p className="mb-4">{t('about_desc_2')}</p>

                                <div className="row mt-5">
                                    <div className="col-6">
                                        <div className="stats-card">
                                            <span className="stats-number">16.8M</span>
                                            <div className="stats-label">{t('about_population')}</div>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="stats-card">
                                            <span className="stats-number">23</span>
                                            <div className="stats-label">{t('about_regions')}</div>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="stats-card">
                                            <span className="stats-number">50+</span>
                                            <div className="stats-label">{t('about_indicators')}</div>
                                        </div>
                                    </div>
                                    <div className="col-6">
                                        <div className="stats-card">
                                            <span className="stats-number">24/7</span>
                                            <div className="stats-label">{t('about_access')}</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Services Section */}
            <section id="services" className="section services-bg">
                <div className="container">
                    <div className="row">
                        <div className="col-12">
                            <h2 className="section-title">{t('services_title')}</h2>
                            <p className="section-subtitle">{t('services_subtitle')}</p>
                        </div>
                    </div>
                    <div className="row">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="col-lg-4 col-md-6 mb-4" data-aos="zoom-in" data-aos-delay={i * 100}>
                                <div className="service-item">
                                    <i className={`bi bi-${['people', 'graph-up', 'clipboard-data', 'mortarboard', 'file-earmark-text', 'headset'][i - 1]}`}></i>
                                    <h4>{t(`service_${i}_title` as any)}</h4>
                                    <p>{t(`service_${i}_desc` as any)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Contact Section */}
            <section id="contact" className="section">
                <div className="container">
                    <div className="row">
                        <div className="col-12">
                            <h2 className="section-title">{t('contact_title')}</h2>
                            <p className="section-subtitle">{t('contact_subtitle')}</p>
                        </div>
                    </div>
                    <div className="row">
                        <div className="col-lg-8 mx-auto">
                            <div className="contact-form" data-aos="fade-up">
                                <form>
                                    <div className="row">
                                        <div className="col-md-6 mb-3">
                                            <div className="form-floating">
                                                <input type="text" className="form-control" id="firstName" placeholder={t('contact_first_name')} />
                                                <label htmlFor="firstName">{t('contact_first_name')}</label>
                                            </div>
                                        </div>
                                        <div className="col-md-6 mb-3">
                                            <div className="form-floating">
                                                <input type="email" className="form-control" id="email" placeholder={t('contact_email')} />
                                                <label htmlFor="email">{t('contact_email')}</label>
                                            </div>
                                        </div>
                                        <div className="col-12 mb-3">
                                            <div className="form-floating">
                                                <textarea className="form-control" id="message" placeholder={t('contact_message')} style={{ height: '150px' }}></textarea>
                                                <label htmlFor="message">{t('contact_message')}</label>
                                            </div>
                                        </div>
                                        <div className="col-12 text-center">
                                            <button type="submit" className="btn btn-submit">
                                                <i className="bi bi-send me-2"></i>{t('contact_send')}
                                            </button>
                                        </div>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>

                    <div className="row mt-5">
                        <div className="col-lg-4 mb-4 text-center" data-aos="fade-up" data-aos-delay="100">
                            <div className="feature-icon mx-auto mb-3">
                                <i className="bi bi-geo-alt"></i>
                            </div>
                            <h5>{t('contact_address_title')}</h5>
                            <p className="text-muted" dangerouslySetInnerHTML={{ __html: t('contact_address') }}></p>
                        </div>
                        <div className="col-lg-4 mb-4 text-center" data-aos="fade-up" data-aos-delay="200">
                            <div className="feature-icon mx-auto mb-3">
                                <i className="bi bi-telephone"></i>
                            </div>
                            <h5>{t('contact_phone_title')}</h5>
                            <p className="text-muted">+235 22 51 44 91<br />+235 22 51 45 92</p>
                        </div>
                        <div className="col-lg-4 mb-4 text-center" data-aos="fade-up" data-aos-delay="300">
                            <div className="feature-icon mx-auto mb-3">
                                <i className="bi bi-envelope"></i>
                            </div>
                            <h5>{t('contact_email_title')}</h5>
                            <p className="text-muted">info@inseed.gov.td<br />data@inseed.gov.td</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="footer">
                <div className="container">
                    <div className="row text-start">
                        <div className="col-lg-4 col-md-6 mb-4">
                            <h5 className="text-white mb-3">{t('nav_brand')}</h5>
                            <p className="text-white-50 mb-4">{t('footer_desc')}</p>
                            <div className="social-links">
                                <a href="#"><i className="bi bi-facebook"></i></a>
                                <a href="#"><i className="bi bi-twitter"></i></a>
                                <a href="#"><i className="bi bi-linkedin"></i></a>
                                <a href="#"><i className="bi bi-youtube"></i></a>
                            </div>
                        </div>
                        <div className="col-lg-2 col-md-6 mb-4">
                            <h6 className="text-white mb-3">{t('footer_quick_links')}</h6>
                            <ul className="list-unstyled">
                                <li className="mb-2"><a href="#home" className="footer-link">{t('footer_home')}</a></li>
                                <li className="mb-2"><a href="#about" className="footer-link">{t('footer_about')}</a></li>
                                <li className="mb-2"><a href="#services" className="footer-link">{t('footer_services')}</a></li>
                                <li className="mb-2"><a href="#contact" className="footer-link">{t('footer_contact')}</a></li>
                            </ul>
                        </div>
                        <div className="col-lg-3 col-md-6 mb-4">
                            <h6 className="text-white mb-3">{t('footer_services_title')}</h6>
                            <ul className="list-unstyled">
                                <li className="mb-2"><a href="#" className="footer-link">{t('footer_census')}</a></li>
                                <li className="mb-2"><a href="#" className="footer-link">{t('footer_economic')}</a></li>
                                <li className="mb-2"><a href="#" className="footer-link">{t('footer_research')}</a></li>
                                <li className="mb-2"><a href="#" className="footer-link">{t('footer_training')}</a></li>
                            </ul>
                        </div>
                        <div className="col-lg-3 col-md-6 mb-4">
                            <h6 className="text-white mb-3">{t('footer_resources')}</h6>
                            <ul className="list-unstyled">
                                <li className="mb-2"><a href="#" className="footer-link">{t('footer_reports')}</a></li>
                                <li className="mb-2"><a href="#" className="footer-link">{t('footer_publications')}</a></li>
                                <li className="mb-2"><a href="#" className="footer-link">{t('footer_data_portal')}</a></li>
                                <li className="mb-2"><a href="#" className="footer-link">{t('footer_api')}</a></li>
                            </ul>
                        </div>
                    </div>
                    <hr className="my-4" style={{ borderColor: 'rgba(255,255,255,0.2)' }} />
                    <div className="row align-items-center">
                        <div className="col-md-6 text-start">
                            <p className="text-white-50 mb-0">{t('footer_copyright')}</p>
                        </div>
                        <div className="col-md-6 text-md-end">
                            <a href="#" className="footer-link me-3">{t('footer_privacy')}</a>
                            <a href="#" className="footer-link">{t('footer_terms')}</a>
                        </div>
                    </div>
                </div>
            </footer>

        </div>
    );
};

export default LandingPage;
