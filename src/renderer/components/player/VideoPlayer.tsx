import './styles/VideoPlayer.css';
import 'react-activity/dist/Dots.css';

import { IVideo } from '@consumet/extensions';
import Store from 'electron-store';
import Hls from 'hls.js';
import { useEffect, useRef, useState } from 'react';
import ReactDOM from 'react-dom';
import toast, { Toaster } from 'react-hot-toast';

import {
  updateAnimeFromList,
  updateAnimeProgress,
} from '../../../modules/anilist/anilistApi';
import { getUniversalEpisodeUrl } from '../../../modules/providers/api';
import { getAvailableEpisodes } from '../../../modules/utils';
import { ListAnimeData } from '../../../types/anilistAPITypes';
import { EpisodeInfo } from '../../../types/types';
import BottomControls from './BottomControls';
import MidControls from './MidControls';
import TopControls from './TopControls';

const STORE = new Store();
const style = getComputedStyle(document.body);
const videoPlayerRoot = document.getElementById('video-player-root');
var timer: any;
var pauseInfoTimer: any;

interface VideoPlayerProps {
  video: IVideo | null;
  listAnimeData: ListAnimeData;
  episodesInfo?: EpisodeInfo[];
  animeEpisodeNumber: number;
  show: boolean;
  loading: boolean;

  // when progress updates from video player,
  // this helps displaying the correct progress value
  onLocalProgressChange: (localprogress: number) => void;
  onChangeLoading: (value: boolean) => void;
  onClose: () => void;
}

const VideoPlayer: React.FC<VideoPlayerProps> = ({
  video,
  listAnimeData,
  episodesInfo,
  animeEpisodeNumber,
  show,
  loading,
  onLocalProgressChange,
  onChangeLoading,
  onClose,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [hlsData, setHlsData] = useState<Hls>();

  // const [title, setTitle] = useState<string>(animeTitle); // may be needed in future features
  const [videoData, setVideoData] = useState<IVideo | null>(null);
  const [episodeNumber, setEpisodeNumber] = useState<number>(0);
  const [episodeTitle, setEpisodeTitle] = useState<string>('');
  const [episodeDescription, setEpisodeDescription] = useState<string>('');
  const [progressUpdated, setProgressUpdated] = useState<boolean>(false);

  // controls
  const [showControls, setShowControls] = useState<boolean>(false);
  const [showPauseInfo, setShowPauseInfo] = useState<boolean>(false);
  const [showCursor, setShowCursor] = useState<boolean>(false);
  const [playing, setPlaying] = useState<boolean>(true);
  const [fullscreen, setFullscreen] = useState<boolean>(false);
  const [isSettingsShowed, setIsSettingsShowed] = useState<boolean>(false);
  const [showNextEpisodeButton, setShowNextEpisodeButton] =
    useState<boolean>(true);
  const [showPreviousEpisodeButton, setShowPreviousEpisodeButton] =
    useState<boolean>(true);

  // timeline
  const [currentTime, setCurrentTime] = useState<number>();
  const [duration, setDuration] = useState<number>();
  const [buffered, setBuffered] = useState<TimeRanges>();

  // const [videoLoading, setLoading] = useState<boolean>(loading);

  useEffect(() => {
    const video = videoRef.current;

    const handleSeeked = () => {
      console.log('seeked');
      onChangeLoading(false);
      setPlaying(true);
    };

    const handleWaiting = () => {
      console.log('waiting');
      onChangeLoading(true);
      setPlaying(false);
    };

    if (video) {
      video.addEventListener('seeked', handleSeeked);
      video.addEventListener('waiting', handleWaiting);

      return () => {
        video.removeEventListener('seeked', handleSeeked);
        video.removeEventListener('waiting', handleWaiting);
      };
    }
  }, []);

  useEffect(() => {
    onChangeLoading(loading);
  }, [loading]);

  useEffect(() => {
    if (video !== null) {
      playHlsVideo(video.url);
      // loadSource(video.url, video.isM3U8 ?? false);
      setVideoData(video);
      setEpisodeNumber(animeEpisodeNumber);
      setEpisodeTitle(
        episodesInfo
          ? episodesInfo[animeEpisodeNumber].title?.en ??
              `Episode ${animeEpisodeNumber}`
          : `Episode ${animeEpisodeNumber}`,
      );
      setEpisodeDescription(
        episodesInfo ? episodesInfo[animeEpisodeNumber].summary ?? '' : '',
      );

      setShowNextEpisodeButton(canNextEpisode(animeEpisodeNumber));
      setShowPreviousEpisodeButton(canPreviousEpisode(animeEpisodeNumber));
    }
  }, [video]);

  const playHlsVideo = (url: string) => {
    try {
      if (Hls.isSupported() && videoRef.current) {
        var hls = new Hls();
        hls.loadSource(url);
        hls.attachMedia(videoRef.current);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (videoRef.current) {
            hls.currentLevel = hls.levels.length - 1;
            playVideoAndSetTime();
            setHlsData(hls);
          }
        });
      }
    } catch (error) {
      console.log(error);
    }
  };

  const playVideo = () => {
    if (videoRef.current) {
      try {
        setPlaying(true);
        videoRef.current.play();
      } catch (error) {
        console.log(error);
      }
    }
  };

  const pauseVideo = () => {
    if (videoRef.current) {
      try {
        setPlaying(false);
        videoRef.current.pause();
      } catch (error) {
        console.log(error);
      }
    }
  };

  const togglePlayingWithoutPropagation = (event: any) => {
    if (event.target !== event.currentTarget) return;
    playing ? pauseVideo() : playVideo();
  };

  const togglePlaying = () => {
    playing ? pauseVideo() : playVideo();
  };

  const playVideoAndSetTime = () => {
    try {
      if (videoRef.current) {
        setTimeout(() => {
          playVideo();
          setCurrentTime(videoRef.current?.currentTime);
          setDuration(videoRef.current?.duration);
          onChangeLoading(false);
        }, 1000);
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleTimeUpdate = () => {
    const cTime = videoRef.current?.currentTime;
    const dTime = videoRef.current?.duration;

    try {
      if (cTime && dTime) {
        setShowPauseInfo(false);
        setCurrentTime(cTime);
        setDuration(dTime);
        setBuffered(videoRef.current?.buffered);

        // automatically update progress
        // console.log((cTime * 100) / dTime);
        if (
          (cTime * 100) / dTime > 85 &&
          (STORE.get('update_progress') as boolean) &&
          !progressUpdated
        ) {
          // when updating progress, put the anime in current if it wasn't there
          const status = listAnimeData.media.mediaListEntry?.status;

          switch (status) {
            case 'CURRENT': {
              updateAnimeProgress(listAnimeData.media.id!, episodeNumber);
              break;
            }
            case 'REPEATING':
            case 'COMPLETED': {
              updateAnimeFromList(
                listAnimeData.media.id,
                'REWATCHING',
                undefined,
                episodeNumber,
              );
            }
            default: {
              updateAnimeFromList(
                listAnimeData.media.id,
                'CURRENT',
                undefined,
                episodeNumber,
              );
            }
          }

          setProgressUpdated(true);
          onLocalProgressChange(episodeNumber);
        }
      }
    } catch (error) {
      console.log(error);
    }
  };

  const handleVideoPause = () => {
    clearTimeout(pauseInfoTimer);
    setShowPauseInfo(false);
    pauseInfoTimer = setTimeout(() => {
      !isSettingsShowed && setShowPauseInfo(true);
    }, 7500);
  };

  const handleMouseMove = () => {
    clearTimeout(pauseInfoTimer);
    setShowPauseInfo(false);

    pauseInfoTimer = setTimeout(() => {
      try {
        if (videoRef.current && videoRef.current.paused) {
          !isSettingsShowed && setShowPauseInfo(true);
        }
      } catch (error) {
        console.log(error);
      }
    }, 7500);

    clearTimeout(timer);
    setShowControls(true);
    setShowCursor(true);

    setShowPauseInfo(false);

    if (isSettingsShowed) return;

    timer = setTimeout(() => {
      // setShowControls(false);
      // setShowCursor(false);
    }, 2000);
  };

  const handleExit = () => {
    if (document.fullscreenElement) {
      setFullscreen(false);
      document.exitFullscreen();
    }
    onClose();
  };

  const toggleFullScreenWithoutPropagation = (event: any) => {
    if (event.target !== event.currentTarget) return;
    toggleFullScreen();
  };

  const toggleFullScreen = () => {
    if (document.fullscreenElement) {
      setFullscreen(false);
      document.exitFullscreen();
    } else {
      if (document.documentElement.requestFullscreen) {
        setFullscreen(true);
        document.documentElement.requestFullscreen();
      }
    }
  };

  const changeEpisode = async (
    episode: number,
    reloadAtPreviousTime?: boolean,
  ) => {
    onChangeLoading(true);

    var previousTime = 0;
    if (reloadAtPreviousTime && videoRef.current)
      previousTime = videoRef.current?.currentTime;

    getUniversalEpisodeUrl(listAnimeData, episode).then((data) => {
      if (!data) {
        toast(`Source not found.`, {
          style: {
            color: style.getPropertyValue('--font-2'),
            backgroundColor: style.getPropertyValue('--color-3'),
          },
          icon: '❌',
        });

        return;
      }

      setData(data);
    });

    const setData = (value: IVideo) => {
      setVideoData(value);
      setEpisodeNumber(episode);
      setEpisodeTitle(
        episodesInfo
          ? episodesInfo[episode].title?.en ?? `Episode ${episode}`
          : `Episode ${episode}`,
      );
      setEpisodeDescription(
        episodesInfo ? episodesInfo[episode].summary ?? '' : '',
      );
      playHlsVideo(value.url);
      // loadSource(value.url, value.isM3U8 ?? false);
      setShowNextEpisodeButton(canNextEpisode(episode));
      setShowPreviousEpisodeButton(canPreviousEpisode(episode));
      setProgressUpdated(false);

      try {
        if (videoRef.current && reloadAtPreviousTime)
          videoRef.current.currentTime = previousTime;
      } catch (error) {
        console.log(error);
      }

      onChangeLoading(false);
    };
  };

  const canPreviousEpisode = (episode: number): boolean => {
    return episode !== 1;
  };

  const canNextEpisode = (episode: number): boolean => {
    return episode !== getAvailableEpisodes(listAnimeData.media);
  };

  return ReactDOM.createPortal(
    show && (
      <>
        <div
          className={`container ${showControls ? 'show-controls' : ''} ${showPauseInfo ? 'show-pause-info' : ''}`}
          onMouseMove={handleMouseMove}
          ref={containerRef}
        >
          <div className="pause-info">
            <div className="content">
              <h1 className="you-are-watching">You are watching</h1>
              <h1 id="pause-info-anime-title">
                {listAnimeData.media.title?.english}
              </h1>
              <h1 id="pause-info-episode-title">{episodeTitle}</h1>
              <h1 id="pause-info-episode-description">{episodeDescription}</h1>
            </div>
          </div>
          <div
            className={`shadow-controls ${showCursor ? 'show-cursor' : ''}`}
            onClick={togglePlayingWithoutPropagation}
            onDoubleClick={toggleFullScreenWithoutPropagation}
          >
            <TopControls
              videoRef={videoRef}
              hls={hlsData}
              listAnimeData={listAnimeData}
              episodesInfo={episodesInfo}
              episodeNumber={episodeNumber}
              episodeTitle={episodeTitle}
              showNextEpisodeButton={showNextEpisodeButton}
              showPreviousEpisodeButton={showPreviousEpisodeButton}
              fullscreen={fullscreen}
              onFullScreentoggle={toggleFullScreen}
              onChangeEpisode={changeEpisode}
              onSettingsToggle={(isShowed) => setIsSettingsShowed(isShowed)}
              onExit={handleExit}
              onClick={togglePlayingWithoutPropagation}
              onDblClick={toggleFullScreenWithoutPropagation}
            />
            <MidControls
              videoRef={videoRef}
              playing={playing}
              playVideo={playVideo}
              pauseVideo={pauseVideo}
              loading={loading}
              onClick={togglePlayingWithoutPropagation}
              onDblClick={toggleFullScreenWithoutPropagation}
            />
            <BottomControls
              videoRef={videoRef}
              containerRef={containerRef}
              currentTime={currentTime}
              duration={duration}
              buffered={buffered}
              onClick={togglePlayingWithoutPropagation}
              onDblClick={toggleFullScreenWithoutPropagation}
            />
          </div>
          <video
            id="video"
            ref={videoRef}
            onTimeUpdate={handleTimeUpdate}
            onPause={handleVideoPause}
            crossOrigin="anonymous"
          ></video>
        </div>
        <Toaster />
      </>
    ),
    videoPlayerRoot!,
  );
};

export default VideoPlayer;
