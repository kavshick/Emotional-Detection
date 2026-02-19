import React from 'react';
import { ShieldCheck, Code2, Users, FileStack } from 'lucide-react';

const AboutProject = () => {
    return (
        <div className="max-w-4xl mx-auto py-8">
            <h1 className="text-3xl font-bold mb-8">About the Project</h1>
            
            <div className="bg-card border border-border rounded-xl p-8 mb-8">
                <p className="text-lg leading-relaxed text-muted-foreground mb-6">
                    This Emotion Intelligence Suite is a cutting-edge demonstration of real-time computer vision and 
                    deep learning capabilities. It was built to showcase how modern web technologies can interface 
                    seamlessly with powerful backend AI models.
                </p>
                <div className="grid md:grid-cols-2 gap-8 mt-12">
                     <div>
                        <h3 className="flex items-center text-lg font-semibold mb-3">
                            <Code2 className="mr-2 text-primary" size={20} />
                            Tech Stack
                        </h3>
                        <ul className="space-y-2 text-sm text-muted-foreground ml-2">
                            <li>• Frontend: React + Vite + Tailwind CSS</li>
                            <li>• Backend: Flask (Python)</li>
                            <li>• AI Model: DeepFace (TensorFlow/Keras)</li>
                            <li>• Face Tracking: Google Mediapipe FaceMesh</li>
                        </ul>
                     </div>
                     <div>
                        <h3 className="flex items-center text-lg font-semibold mb-3">
                            <ShieldCheck className="mr-2 text-primary" size={20} />
                            Key Capabilities
                        </h3>
                         <ul className="space-y-2 text-sm text-muted-foreground ml-2">
                            <li>• 7-Class Emotion Classification</li>
                            <li>• Real-time Face Tracking (60fps+)</li>
                            <li>• Session Persistence & Replay</li>
                            <li>• Responsive Modern UI</li>
                        </ul>
                     </div>
                </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                 <div className="bg-secondary/20 p-6 rounded-xl border border-border/50">
                    <h3 className="font-semibold mb-2 flex items-center">
                        <Users className="mr-2" size={18} />
                        Team
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Developed by Kavshick and Deepak with the assistance of Generative AI.
                    </p>
                 </div>
                 <div className="bg-secondary/20 p-6 rounded-xl border border-border/50">
                    <h3 className="font-semibold mb-2 flex items-center">
                        <FileStack className="mr-2" size={18} />
                        Documentation
                    </h3>
                    <p className="text-sm text-muted-foreground">
                        Full API documentation and architecture diagrams are available in the docs folder in the git repository.
                    </p>
                 </div>
            </div>
        </div>
    );
};

export default AboutProject;
