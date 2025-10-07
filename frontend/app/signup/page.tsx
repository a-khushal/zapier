"use client"

import React, { useState } from 'react';
import { Check, Eye, EyeOff } from 'lucide-react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

function App() {
  const router = useRouter()
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    userName: '',
    password: ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
    await axios.post("http://localhost:8080/api/v1/user/signup", formData);
    router.push("/login")
  };

  const features = [
    'Easy setup, no coding required',
    'Free forever for core features',
    '14-day trial of premium features & apps'
  ];

  const companies = [
    { name: 'Dropbox', class: 'opacity-50' },
    { name: 'Lyft', class: 'opacity-50' },
    { name: 'HelloFresh', class: 'opacity-50' },
    { name: 'Asana', class: 'opacity-50' },
    { name: 'Zendesk', class: 'opacity-50' }
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-6xl w-full grid md:grid-cols-2 gap-12 items-center">
        <div className="space-y-8">
          <h1 className="text-4xl font-bold text-gray-900">
            Join millions worldwide who automate their work using Synq.
          </h1>
          <div className="space-y-4">
            {features.map((feature, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="bg-green-100 rounded-full p-1">
                  <Check className="w-4 h-4 text-green-600" />
                </div>
                <span className="text-gray-700">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200">
          {/* <button className="w-full bg-[#4285f4] text-white rounded-md py-2.5 px-4 flex items-center justify-center gap-2 mb-6">
            <div className='p-px bg-white rounded-sm inline-block'>
              <GOogleSVG />
            </div>
            <span>Sign up with Google</span>
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-white px-4 text-sm text-gray-500">OR</span>
            </div>
          </div> */}

          <div className='flex justify-center items-center mb-6 text-xl font-semibold'>Sign up to Synq</div>

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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={formData.userName}
                  onChange={(e) => setFormData({ ...formData, userName: e.target.value })}
                  minLength={3}
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
                            minLength={8}
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
            </div>
            <div className="text-sm text-gray-600">
              By signing up, you agree to Synq&lsquo;s{' '}
              <a href="#" className="text-blue-600 hover:underline">terms of service</a>{' '}
              and{' '}
              <a href="#" className="text-blue-600 hover:underline">privacy policy</a>.
            </div>

            <button
              type="submit"
              className="w-full bg-[#ff4f00] hover:bg-[#ff4f00]/90 text-white rounded-md py-2.5 px-4"
            >
              Get started for free
            </button>
            <div className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <a href="/login" className="text-blue-600 hover:underline">Log in</a>
            </div>
          </form>
        </div>
      </div>

      <div className="space-y-4 mt-14 text-center">
        <p className="text-sm text-gray-600">Trusted at companies large and small</p>
        <div className="grid grid-cols-5 gap-4">
          {companies.map((company, index) => (
            <div key={index} className={`text-gray-700 text-2xl font-medium ${company.class}`}>
              {company.name}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default App;