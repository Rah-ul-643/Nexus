import React, { useEffect, useRef, useState } from 'react'
import { Peer } from "peerjs";
import { io } from 'socket.io-client';
import { Camera, PhoneOff, PhoneIncoming, Copy, Check } from 'lucide-react';
import useRingtone from '../CustomHooks/useRingtone';

const VideoCall = () => {
    const [isLoading, setIsLoading] = useState(true);
    const [socket, setSocket] = useState(null);
    const [peer, setPeer] = useState(null);
    const [inputUserId, setInputUserId] = useState('');
    const [isCopied, setIsCopied] = useState(false);
    const [myVideoStream, setMyVideoStream] = useState(null);
    const [myId, setMyId] = useState('');
    const [callState, setCallState] = useState({
        isConnected: false,
        isCallIncoming: false,
        isCallOutgoing: false,
        outgoingCall: null,
        incomingCall: null,
        incomingCallerId: ''
    });

    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL;
    const ringtone = useRingtone('/messenger_video_call.mp3');

    const myVideoComponent = useRef();
    const remoteVideoComponent = useRef();

    useEffect(() => {

        const socket = io(`${API_BASE_URL}`);
        setSocket(socket);

        socket.on('connect', () => {

            console.log('Connected to socket server with id: ', socket.id);
            const peer = new Peer(socket.id);
            setPeer(peer);

            const setVideo = async () => {
                const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                myVideoComponent.current.srcObject = stream;
                setMyVideoStream(stream);
            }

            peer.on('open', (id) => {
                console.log("My peer ID:", id);
                setMyId(id);
                setVideo();
                setIsLoading(false);
            });

            peer.on("call", (call) => {
                try {
                    ringtone.play();

                    setCallState(prev => ({
                        ...prev,
                        isCallIncoming: true,
                        incomingCall: call,
                        incomingCallerId: call.peer
                    }));

                    call.on('close', () => {
                        endCall();
                    });

                } catch (error) {
                    console.error("Error accessing media devices", error);
                }
            });
        });

        socket.on('cancelCall', () => {
            ringtone.stop();
            resetCallState();
        });

        return () => {
            socket.disconnect();
        };

    }, []);

    const handleInputChange = (e) => {
        setInputUserId(e.target.value);
    }

    const callUser = async (remoteId) => {
        try {
            if (remoteId === myId || callState.isConnected) {
                console.log("Action not allowed");
                return;
            }

            const call = peer.call(remoteId, myVideoStream);

            setCallState(prev => ({
                ...prev,
                isCallOutgoing: true,
                outgoingCall: call,
            }));

            call.on('stream', (remoteStream) => {
                remoteVideoComponent.current.srcObject = remoteStream;
                setCallState(prev => ({
                    ...prev,
                    isCallOutgoing: false,
                    isConnected: true,
                }));
            });

            call.on('close', () => {
                endCall();
            });

        } catch (error) {
            console.error("Error initiating call", error);
        }
    }

    const copyPeerId = () => {
        navigator.clipboard.writeText(myId);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    }

    const resetCallState = () => {
        setCallState({
            isConnected: false,
            isCallIncoming: false,
            isCallOutgoing: false,
            incomingCall: null,
            outgoingCall: null,
            incomingCallerId: ''
        });
    }

    const acceptCall = () => {
        ringtone.stop();
        callState.incomingCall.answer(myVideoStream);
        callState.incomingCall.on("stream", (remoteStream) => {
            remoteVideoComponent.current.srcObject = remoteStream;
            setCallState(prev => ({
                ...prev,
                isConnected: true,
                isCallIncoming: false
            }));
        });
    }

    const declineCall = () => {
        ringtone.stop();

        if (callState.incomingCall) {
            console.log("declined call");
            callState.incomingCall.close();
            socket.emit('cancelCall', callState.incomingCallerId);
        }

        resetCallState();
    }

    const cancelCall = () => {

        if (callState.outgoingCall) {
            console.log("Outgoing call cancelled");
            callState.outgoingCall.close();
            socket.emit('cancelCall', inputUserId);
        }

        resetCallState();
    }

    const endCall = () => {
        if (remoteVideoComponent.current.srcObject) {
            remoteVideoComponent.current.srcObject.getTracks().forEach(track => track.stop());
        }

        [callState.incomingCall, callState.outgoingCall].forEach(call => {
            if (call) {
                call.close();
            }
        });

        resetCallState();
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 flex flex-col items-center justify-center p-4">
            {isLoading &&
                <div>
                    <div className="flex flex-col items-center justify-center space-y-4 animate-pulse-slow">
                        <div className="w-16 h-16 border-4 border-t-black rounded-full animate-spin"></div>
                        <p className="text-black text-center font-semibold text-lg">
                            Loading...
                        </p>
                    </div>
                </div>
            }
            {!isLoading &&
                <div className="bg-white shadow-2xl rounded-2xl p-6 w-full max-w-6xl">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center space-x-4">
                            <Camera className="text-purple-600" size={32} />
                            <h2 className="text-2xl font-bold text-gray-800">Nexus</h2>
                        </div>
                        <div className="flex items-center space-x-2">
                            <span className="text-sm text-gray-600">Your ID: {myId}</span>
                            <button
                                onClick={copyPeerId}
                                className="text-purple-600 hover:bg-purple-100 p-2 rounded-full transition-colors"
                            >
                                {isCopied ? <Check size={20} /> : <Copy size={20} />}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-4">
                        <div className="col-span-8 relative">
                            {/* Remote Video (Main Screen) */}
                            <video
                                ref={remoteVideoComponent}
                                autoPlay
                                className={`w-full h-[500px] object-cover rounded-xl shadow-lg transition-all duration-300 ${callState.isConnected ? 'opacity-100' : 'opacity-20'}`}
                                title='Remote Video'
                            />
                            {!callState.isConnected && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/50 rounded-xl">
                                    <p className="text-gray-500 text-xl">Start a call to view your friend's video here. </p>
                                </div>
                            )}
                        </div>

                        <div className="col-span-4 flex flex-col justify-evenly space-y-4 h-full">

                            {/* Connection Controls */}
                            <div className="space-y-3">
                                <input
                                    type="text"
                                    placeholder="Enter friend's ID to call"
                                    value={inputUserId}
                                    onChange={handleInputChange}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                />
                                <div className="flex space-x-2">
                                    <button
                                        onClick={() => callUser(inputUserId)}
                                        className={`flex-1 py-2 rounded-lg transition-colors flex items-center justify-center space-x-2 ${callState.isConnected
                                                ? "bg-gray-400 text-gray-600 cursor-not-allowed"
                                                : "bg-purple-600 text-white hover:bg-purple-700"
                                            }`}
                                        disabled={callState.isConnected}
                                    >
                                        <PhoneIncoming size={20} />
                                        <span>Call</span>
                                    </button>
                                    {callState.isConnected && (
                                        <button
                                            onClick={endCall}
                                            className="bg-red-500 text-white p-2 rounded-lg hover:bg-red-600 transition-colors"
                                        >
                                            <PhoneOff size={20} />
                                        </button>
                                    )}
                                </div>
                            </div>
                            {/* My Video (Small Corner) */}
                            <div className="relative">
                                <video
                                    ref={myVideoComponent}
                                    muted
                                    autoPlay
                                    className="w-full h-auto object-cover rounded-xl shadow-md"
                                    title='My Video'
                                />
                            </div>

                            {callState.isCallOutgoing && (
                                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-xl flex items-center justify-center z-10 animate-fade-in">
                                    <div className="bg-white/90 p-6 rounded-2xl shadow-2xl text-center space-y-4 transform transition-all duration-300 hover:scale-105">
                                        <div className="flex justify-center mb-4">
                                            <div className="animate-pulse p-3 bg-purple-100 rounded-full">
                                                <PhoneIncoming className="text-purple-600" size={32} />
                                            </div>
                                        </div>
                                        <h3 className="text-xl font-bold text-gray-800 tracking-wide">
                                            Connecting Call
                                        </h3>
                                        <p className="text-gray-600 mb-4">
                                            Calling {inputUserId}
                                        </p>
                                        <div className="flex justify-center space-x-2">
                                            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                                            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                                            <div className="w-3 h-3 bg-purple-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }}></div>
                                        </div>
                                        <button
                                            onClick={cancelCall}
                                            className="mt-4 bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors flex items-center justify-center space-x-2 mx-auto"
                                        >
                                            <PhoneOff size={20} />
                                            <span>Cancel</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                            {callState.isCallIncoming && callState.incomingCallerId && (
                                <div className="absolute inset-0 bg-black/30 backdrop-blur-sm rounded-xl flex items-center justify-center z-10 animate-fade-in">
                                    <div className="bg-white/90 p-6 rounded-2xl shadow-2xl text-center space-y-4 transform transition-all duration-300 hover:scale-105">
                                        <div className="flex justify-center mb-4">
                                            <div className="animate-pulse p-3 bg-purple-100 rounded-full">
                                                <PhoneIncoming className="text-purple-600" size={32} />
                                            </div>
                                        </div>

                                        <h3 className="text-xl font-bold text-gray-800 tracking-wide">Incoming Call</h3>
                                        <p className="text-gray-600 mb-4">From: {callState.incomingCallerId}</p>

                                        <div className="flex justify-center space-x-2">
                                            <button
                                                onClick={acceptCall}
                                                className="bg-green-500 text-white p-2 rounded-full hover:bg-green-600 transition-colors"
                                            >
                                                <Check size={24} />
                                            </button>
                                            <button
                                                onClick={declineCall}
                                                className="bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors"
                                            >
                                                <PhoneOff size={24} />
                                            </button>
                                        </div>

                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                </div>}
        </div >
    )
}

export default VideoCall;