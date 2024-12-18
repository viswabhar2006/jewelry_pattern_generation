import React, { useState, useEffect } from 'react';
import { jwtDecode } from 'jwt-decode'; // Correctly import jwtDecode
import { useNavigate } from 'react-router-dom';
import "./Indexx.css";

const Indexx = () => {
    const [activeSection, setActiveSection] = useState("Home");
    const [imagePreview, setImagePreview] = useState(null);
    const [slideIndex, setSlideIndex] = useState(0);
    const [activeFAQ, setActiveFAQ] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [uploadedImagePreview, setUploadedImagePreview] = useState(null);
    const [generatedImagePreview, setGeneratedImagePreview] = useState(null);
    const [isLoading, setIsLoading] = useState(false); // Loader state
    const navigate = useNavigate();

    const slides = [
        { src1: "/assets/sketch/1.jpg", alt1: "Jewelry Sketch 1", src2: "assets/original/1.jpg", alt2: "Jewelry Design 1" },
        { src1: "/assets/sketch/2.jpg", alt1: "Jewelry Sketch 2", src2: "/assets/original/2.jpg", alt2: "Jewelry Design 2" },
        { src1: "/assets/sketch/3.jpg", alt1: "Jewelry Sketch 3", src2: "/assets/original/3.jpg", alt2: "Jewelry Design 3" },
        { src1: "/assets/sketch/4.jpg", alt1: "Jewelry Sketch 4", src2: "/assets/original/4.jpg", alt2: "Jewelry Design 4" },
        { src1: "/assets/sketch/5.jpg", alt1: "Jewelry Sketch 5", src2: "/assets/original/5.jpg", alt2: "Jewelry Design 5" },
    ];

    const nextSlide = () => {
        setSlideIndex((prev) => (prev + 1) % slides.length);
    };

    const prevSlide = () => {
        setSlideIndex((prev) => (prev - 1 + slides.length) % slides.length);
    };

    const toggleFAQ = (index) => {
        setActiveFAQ(activeFAQ === index ? null : index);
    };

    useEffect(() => {
        // Check for token in query parameters (for OAuth redirect)
        const queryParams = new URLSearchParams(window.location.search);
        const tokenFromQuery = queryParams.get('token');

        if (tokenFromQuery) {
            // Save the token to session storage
            sessionStorage.setItem('token', tokenFromQuery);
            // Clear query parameters from the URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }

        // Check for token in session storage
        const token = sessionStorage.getItem('token');
        if (!token) {
            navigate('/login');
            return;
        }

        try {
            const decodedToken = jwtDecode(token);
            fetchUserProfile(token);
        } catch (error) {
            console.error('Invalid token:', error);
            sessionStorage.removeItem('token'); // Clear invalid token
            navigate('/login');
        }
    }, [navigate]);

    const fetchUserProfile = async (token) => {
        try {
            const response = await fetch('http://localhost:3001/profile', {
                method: 'GET',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
            });

            if (!response.ok) {
                alert('Failed to fetch profile data.');
                navigate('/login');
                return;
            }

            const data = await response.json();
            setUserProfile(data);
        } catch (error) {
            console.error('Error:', error);
            alert('An error occurred while fetching profile data.');
        }
    };

    const handleSignOut = () => {
        sessionStorage.removeItem('token');
        alert('You have signed out!');
        navigate('/login');
    };


    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = () => setUploadedImagePreview(reader.result);
            reader.readAsDataURL(file);
        }
    };

    const handleImageGeneration = async (e) => {
        e.preventDefault();
    
        if (!uploadedImagePreview) {
            alert("Please upload an image first.");
            return;
        }
    
        setIsLoading(true);
    
        try {
            const token = sessionStorage.getItem('token');
            if (!token) {
                alert("Authentication token not found. Please log in again.");
                setIsLoading(false);
                return;
            }
    
            // Upload image
            const formData = new FormData();
            const imageFile = document.querySelector('input[type="file"]').files[0];
            formData.append('imageInput', imageFile);
    
            const uploadResponse = await fetch('http://localhost:3001/upload', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                },
                body: formData,
            });
    
            if (!uploadResponse.ok) {
                alert("Error uploading image. Please try again.");
                setIsLoading(false);
                return;
            }
    
            const uploadData = await uploadResponse.json();
            const uploadedFilePath = uploadData.filePath;
    
            // Process image - use FormData instead of JSON
            const processFormData = new FormData();
            processFormData.append('imageInput', imageFile);
    
            const processResponse = await fetch('http://localhost:5000/process-image', {
                method: 'POST',
                body: processFormData,
            });
    
            if (!processResponse.ok) {
                alert("Error generating image. Please try again.");
                setIsLoading(false);
                return;
            }
    
            const blob = await processResponse.blob();
            const generatedImageURL = URL.createObjectURL(blob);
            setGeneratedImagePreview(generatedImageURL);
        } catch (error) {
            console.error("Error generating image:", error);
            alert("An error occurred while generating the image. Please try again later.");
        } finally {
            setIsLoading(false);
        }
    };

    const sections = {
        Home: (
            
<div className="home-section">
                <div className="slideshow-container">
                    <div className="mySlides">
                    <img src={slides[slideIndex].src1} alt={slides[slideIndex].alt1} />
                    <img src={slides[slideIndex].src2} alt={slides[slideIndex].alt2} />
                    </div>
                    <a className="prev" onClick={prevSlide}>
                        &#10094;
                    </a>
                    <a className="next" onClick={nextSlide}>
                        &#10095;
                    </a>
                </div>

                <div className="Instruct"> 
                    <h1>INSTRUCTIONS</h1>
                </div>

                <div className="content-boxes">
                    <div className="box">
                        <h3>Step 1</h3>
                        <p>Choose your design inspiration.</p>
                    </div>
                    <div className="box">
                        <h3>Step 2</h3>
                        <p>Upload your favorite patterns.</p>
                    </div>
                    <div className="box">
                        <h3>Step 3</h3>
                        <p>Discover our unique jewelry collections.</p>
                    </div>
                </div>
            </div>
        ),
        upload: (
            <div className="upload-section">
                <div className="upload-container">
                    <form className="upload-form" onSubmit={handleImageGeneration}>
                        <input
                            type="file"
                            name="image"
                            accept="image/*"
                            className="file-input"
                            onChange={handleImageUpload}
                        />
                        <button type="submit" className="submit-button">Submit</button>
                    </form>
                </div>
                <div className="image-preview-container">
                    <div className="image-preview-box">
                        <h3>Uploaded Image</h3>
                        {uploadedImagePreview ? (
                            <img src={uploadedImagePreview} alt="Uploaded Preview" className="preview-image" />
                        ) : (
                            <p className="placeholder-text">No image uploaded</p>
                        )}
                    </div>
                    <div className="image-preview-box">
                        <h3>Generated Image</h3>
                        {isLoading ? (
                            <div className="loader"></div> // Loader element
                        ) :  generatedImagePreview ? (
                            <img src={generatedImagePreview} alt="Generated Preview" className="preview-image" />
                        ) : (
                            <p className="placeholder-text">No image generated</p>
                        )}
                    </div>
                </div>
            </div>
        ),

        about: (
            <div className="about-section">
                <div className="faq-with-image">
                    <div className="faq-container">
                        <h2 className="faq-heading">Frequently Asked Questions</h2>
                        <div className="faq-container">
                            <div className="faq">
                                <div className="faq-question" onClick={() => toggleFAQ(0)}>
                                    <h3>What is Jewelry Design Pattern Generation?
                                        <span className="toggle-icon">{activeFAQ === 0 ? "-" : "+"}</span>
                                    </h3>
                                    {activeFAQ === 0 && <p>It is a process of creating unique jewelry designs using advanced AI tools.</p>}
                                </div>
                                <div className="faq-question" onClick={() => toggleFAQ(1)}>
                                    <h3>
                                        Can I upload my own designs?
                                        <span className="toggle-icon">{activeFAQ === 1 ? "-" : "+"}</span>
                                    </h3>
                                    {activeFAQ === 1 && <p>Yes, you can upload your favorite patterns and inspirations.</p>}
                                </div>
                                <div className="faq-question" onClick={() => toggleFAQ(2)}>
          <                         h3>
            Is this platform free to use?
            <span className="toggle-icon">{activeFAQ === 2 ? "-" : "+"}</span>
          </h3>
          {activeFAQ === 2 && <p>Yes, our platform is free for all users to explore and create designs.</p>}
        </div>
        <div className="faq-question" onClick={() => toggleFAQ(3)}>
          <h3>
            Which AI tool is used in this?
            <span className="toggle-icon">{activeFAQ === 3 ? "-" : "+"}</span>
          </h3>
          {activeFAQ === 3 && <p>GAN (Generative Adverserial Network) has been used to accomplish this task.</p>}
        </div>
        <div className="faq-question" onClick={() => toggleFAQ(4)}>
          <h3>
            What file formats are supported for uploads?
            <span className="toggle-icon">{activeFAQ === 4 ? "-" : "+"}</span>
          </h3>
          {activeFAQ === 4 && <p>We support JPEG, PNG, WEBP and AVIF file formats for uploading designs.</p>}
        </div>
        <div className="faq-question" onClick={() => toggleFAQ(5)}>
          <h3>
            Are the designs copyright-free?
            <span className="toggle-icon">{activeFAQ === 5 ? "-" : "+"}</span>
          </h3>
          {activeFAQ === 5 && <p>Yes, all designs generated are copyright-free and can be used commercially.</p>}
        </div>
      </div>
    </div>
  </div>

                    <div className="faq-image-container">
                        <img src="./assets/question_mark.jpg" alt="Creative Journey" className="faq-image" />
                    </div>
                </div>
            </div>
        ),

        
        profile: (
            <div className="profile-section">
                <h2>Profile Details</h2>
                {userProfile ? (
                    <div className="profile-details">
                        <p><strong>Username:</strong> {userProfile.username || "N/A"}</p>
                        <p><strong>Full Name:</strong> {userProfile.fullName || "N/A"}</p>
                        <p><strong>Email:</strong> {userProfile.email || "N/A"}</p>
                        <p><strong>Phone number:</strong> {userProfile.phone || "N/A"}</p>
                    </div>
                ) : (
                    <p>Loading profile...</p>
                )}
            </div>
        ),        
        contact: (
            <div className="contact-section">
                <h2>Contact Us</h2>
                <div className="contact-details">
                    <pre><i className="fa fa-envelope"></i>  lustrejewelry@gmail.com</pre>
                    <pre><i className="fa fa-phone"></i>  9059717805</pre>
                    <pre><i className="fa fa-map-marker"></i>  KMIT, Narayanaguda</pre>
                </div>
            </div>
        ),
    };

    return (
        <div className="main-container">
            <header className="main-header">
                <div className="header-content">
                <img src="./assets/logo.jpg" alt="Logo" className="logo-image" />
                    <div className="logo"><a href="#">Lustre Jewelry</a></div>
                    <nav className="main-nav">
                        <button className={activeSection === "Home" ? "active" : ""} onClick={() => setActiveSection("Home")}>Home</button>
                        <button className={activeSection === "upload" ? "active" : ""} onClick={() => setActiveSection("upload")}>Upload</button>
                        <button className={activeSection === "about" ? "active" : ""} onClick={() => setActiveSection("about")}>About</button>
                        <button className={activeSection === "profile" ? "active" : ""} onClick={() => setActiveSection("profile")}>Profile</button>
                        <button className={activeSection === "contact" ? "active" : ""} onClick={() => setActiveSection("contact")}>Contact Us</button>
                        <button onClick={handleSignOut}>Sign Out</button>
                    </nav>
                </div>
            </header>
            <div className="content-section">{sections[activeSection]}</div>
        </div>
    );
};

export default Indexx;
