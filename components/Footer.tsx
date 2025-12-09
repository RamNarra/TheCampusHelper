
import React from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, Github, Twitter } from 'lucide-react';

const Footer: React.FC = () => {
  return (
    <footer className="border-t border-border bg-background mt-auto transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
             <div className="flex items-center gap-2 mb-4">
                <div className="bg-primary/10 p-1.5 rounded-lg">
                  <Sparkles className="w-4 h-4 text-primary" />
                </div>
                <span className="text-xl font-bold text-foreground">
                  TheCampus<span className="text-primary font-normal">Helper</span>
                </span>
              </div>
              <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed">
                Empowering students with accessible resources, academic tools, and a collaborative community platform.
              </p>
          </div>
          
          <div>
            <h3 className="text-foreground font-semibold mb-4">Resources</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><Link to="/resources" className="hover:text-primary transition-colors">Lecture Notes</Link></li>
              <li><Link to="/resources" className="hover:text-primary transition-colors">Question Papers</Link></li>
              <li><Link to="/calculator" className="hover:text-primary transition-colors">CGPA Calculator</Link></li>
              <li><Link to="/login" className="hover:text-primary transition-colors">Student Login</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="text-foreground font-semibold mb-4">Community</h3>
            <ul className="space-y-3 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-primary transition-colors">About Us</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Contributors</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Feedback</a></li>
              <li><a href="#" className="hover:text-primary transition-colors">Privacy Policy</a></li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-border mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} TheCampusHelper. Open Source Education.
          </p>
          <div className="flex items-center gap-6">
             <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Github className="w-5 h-5" /></a>
             <a href="#" className="text-muted-foreground hover:text-foreground transition-colors"><Twitter className="w-5 h-5" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
