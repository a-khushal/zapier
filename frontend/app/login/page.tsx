"use client"

import axios from 'axios';
import { ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useRouter } from 'next/navigation';
import React, { useState } from 'react';

export default function Login() {
  const router = useRouter();
    const [showPassword, setShowPassword] = useState(false);
    const [formData, setFormData] = useState({
        email: '',
        password: ''
    });
    
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        console.log('Form submitted:', formData);
        const response = await axios.post("http://localhost:8080/api/v1/user/signin", formData);
        localStorage.setItem("token", "Bearer " + response.data.token);
        router.push("/dashboard")
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
          <div className="max-w-xl w-full items-center">
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
              <div className='flex justify-center items-center mb-6 text-xl font-semibold'>Welcome back</div>
    
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="relative">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Password <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                        <input
                            type={showPassword ? "text" : "password"}
                            required
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 pr-10"
                            value={formData.password}
                            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        />
                        <button
                            type="button"
                            className="absolute inset-y-0 right-3 flex items-center text-gray-500"
                            onClick={() => setShowPassword(!showPassword)}
                        >
                            {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                        </button>
                    </div>
                </div>
                <button
                  type="submit"
                  className="w-full bg-[#ff4f00] hover:bg-[#ff4f00]/90 text-white rounded-md py-2.5 px-4"
                >
                    <div className='flex justify-center items-center'>
                        <div>Login</div>
                        <ArrowRight className='w-5 mt-px ml-1'/>
                    </div>
                </button>
                <div className="text-center text-sm text-gray-600">
                  Do not have an account?{' '}
                  <a href="/signup" className="text-blue-600 hover:underline">Sign up</a>
                </div>
              </form>
            </div>
          </div>
        </div>
    );
}