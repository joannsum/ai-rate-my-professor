'use client'
import { Box, Button, Stack, TextField, Typography } from '@mui/material';
import { useState } from 'react';
import { FaStar } from 'react-icons/fa';
import ReactMarkdown from 'react-markdown';

export default function Home() {

  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hi! I'm the Rate My Professor support assistant. How can I help you today?`,
    },
  ]);
  const [message, setMessage] = useState('');

  const sendMessage = async () => {
    setMessage('');
    setMessages((messages) => [
      ...messages,
      { role: 'user', content: message },
      { role: 'assistant', content: '' },
    ]);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [...messages, { role: 'user', content: message }]
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      if (response.body == null) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let result = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        const contentOnly = JSON.parse(text).content.replace(/^Assistant: /, '').trim();

        setMessages((messages) => {
          let lastMessage = messages[messages.length - 1];
          let otherMessages = messages.slice(0, messages.length - 1);
          return [
            ...otherMessages,
            { ...lastMessage, content: lastMessage.content + contentOnly },
          ];
        });

        result += text;
      }

      return result;
    } catch (error) {
      console.error('Error in sendMessage:', error);
      setMessages((messages) => [
        ...messages,
        { role: 'assistant', content: 'Sorry, an error occurred while processing your request.' },
      ]);
    }
  };

  // function to uploadReviews
  async function uploadReviews() {
    try {
      const response = await fetch('/api/uploadreview', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error uploading reviews: ${response.status} ${errorText}`);
      }

      const result = await response.json();
      console.log('Reviews uploaded successfully:', result);
    } catch (error) {
      console.error('Error:', error);
    }
  }

  return (
    <div>
      {/* Navigation Bar */}
      <nav className="bg-blue-200 shadow-lg border-b-2 border-white-100">
        <div className="container mx-auto px-6 py-3 flex justify-between items-center">
          <div className="text-xl font-bold text-gray-800 flex items-center">
            ProfessStar <FaStar className="text-blue-500 ml-1 text-2xl" />
          </div>
          <div className="space-x-4">
            <a href="#getstarted" className="px-4 py-2 text-white bg-blue-500 rounded hover:bg-blue-600">
              Get Started
            </a>
            <a href="#learnmore" className="px-4 py-2 text-blue-500 border border-blue-500 rounded hover:bg-blue-500 hover:text-white">
              Learn More
            </a>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-purple-100 via-blue-200 to-purple-200 h-screen flex flex-col justify-center items-center">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">Welcome to ProfStar</h1>
        <p className="text-xl text-gray-600 mb-8">Helping students find the best professors and classes.</p>
        <div className="space-x-4">
          <a href="#getstarted" className="px-8 py-4 text-white bg-blue-500 rounded-full hover:bg-blue-600">Get Started</a>
          <a href="#learnmore" className="px-8 py-4 text-blue-500 border border-blue-500 rounded-full hover:bg-blue-500 hover:text-white">Learn More</a>
        </div>
      </section>

      {/* Chatbot Section */}
      <div className="bg-gradient-to-r p-40 from-purple-100 via-blue-200 to-purple-200 relative w-full h-screen flex flex-col lg:flex-row items-center">
        {/* Left Section */}
        <div className="flex flex-col items-center lg:items-start lg:w-1/3 p-6 lg:pl-20 lg:pr-10">
          <FaStar className="text-blue-500 lg:text-6xl mb-4" />
          <Typography variant="h6" className="mb-4 text-center lg:text-left">
            To get started, you can upload a review or message the chatbot directly.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={uploadReviews}
            className="w-full lg:w-auto"
          >
            Upload Review
          </Button>
        </div>

        {/* Chatbox Section */}
        <Box
          id="getstarted" // ID for linking purposes
          width="full"
          maxWidth="lg"
          height="700px"
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="center"
          p={4}
          bgcolor="white"
          borderRadius={10}
          boxShadow={3}
        >
          <Stack
            direction={'column'}
            width="100%"
            height="100%"
            border="1px solid white"
            p={2}
            borderRadius={10}
            spacing={3}
          >
            <Stack
              direction={'column'}
              spacing={2}
              flexGrow={1}
              overflow="auto"
              maxHeight="100%"
            >
              {messages.map((message, index) => (
                <Box
                  key={index}
                  display="flex"
                  justifyContent={
                    message.role === 'assistant' ? 'flex-start' : 'flex-end'
                  }
                >
                  <Box
                    bgcolor={
                      message.role === 'assistant'
                        ? '#e0f7fa'
                        : '#ffecb3'
                    }
                    color="black"
                    borderRadius={16}
                    p={3}
                  >
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </Box>
                </Box>
              ))}
            </Stack>
            <Stack direction={'row'} spacing={2}>
              <TextField
                label="Message"
                fullWidth
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
              <Button variant="contained" onClick={sendMessage}>
                Send
              </Button>
            </Stack>
          </Stack>
        </Box>
      </div>
    </div>
  );
}
