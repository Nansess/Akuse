import './styles/Slideshow.css';

import { IVideo } from '@consumet/extensions';
import { faArrowUpRightFromSquare, faPlay } from '@fortawesome/free-solid-svg-icons';
import axios from 'axios';
import DOMPurify from 'dompurify';
import React, { useEffect, useState } from 'react';
import toast, { Toaster } from 'react-hot-toast';
import Skeleton from 'react-loading-skeleton';

import { EPISODES_INFO_URL } from '../../constants/utils';
import { getUniversalEpisodeUrl } from '../../modules/providers/api';
import {
  capitalizeFirstLetter,
  getAvailableEpisodes,
  getParsedSeasonYear,
  getTitle,
  parseDescription,
} from '../../modules/utils';
import { ListAnimeData } from '../../types/anilistAPITypes';
import { EpisodeInfo } from '../../types/types';
import { ButtonMain } from './Buttons';
import AnimeModal from './modals/AnimeModal';
import { IsInListButton } from './modals/AnimeModalElements';
import VideoPlayer from './player/VideoPlayer';

interface SlideProps {
  listAnimeData: ListAnimeData;
  index: number;
  isVisible: boolean;
}

const Slide: React.FC<SlideProps> = ({ listAnimeData, index, isVisible }) => {
  const style = getComputedStyle(document.body);

  const [playerIVideo, setPlayerIVideo] = useState<IVideo | null>(null);
  const [showPlayer, setShowPlayer] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(false);
  const [episodesInfo, setEpisodesInfo] = useState<EpisodeInfo[]>();

  // whether the modal is shown or not
  const [showModal, setShowModal] = useState<boolean>(false);
  // whether the modal has been opened at least once (used to fetch episodes info only once when opening it)
  const [hasModalBeenShowed, setHasModalBeenShowed] = useState<boolean>(false);

  const [shadowAnimationClasses, setShadowAnimationClasses] = useState<string>('')

  // smoother transitions between slides
  useEffect(() => {
    if(isVisible) {
      setShadowAnimationClasses('show-opacity')
    } else {
      setShadowAnimationClasses('show-opacity hide-opacity-long')
      setTimeout(() => {
        setShadowAnimationClasses('hide-opacity-long')
      }, 400)
    }
  }, [isVisible])

  const fetchEpisodesInfo = async () => {
    axios.get(`${EPISODES_INFO_URL}${listAnimeData.media.id}`).then((data) => {
      if (data.data && data.data.episodes) setEpisodesInfo(data.data.episodes);
    });
  };

  const handlePressButton = async () => {
    setShowPlayer(true);
    setLoading(true);

    await fetchEpisodesInfo();
    getUniversalEpisodeUrl(listAnimeData, 1).then((data) => {
      if (!data) {
        toast(`Source not found.`, {
          style: {
            color: style.getPropertyValue('--font-2'),
            backgroundColor: style.getPropertyValue('--color-3'),
          },
          icon: '❌',
        });
        setLoading(false);

        return;
      }
      setPlayerIVideo(data);
      setLoading(false);
    });
  };

  const handleChangeLoading = (value: boolean) => {
    setLoading(value);
  };

  return (
    <>
      {showPlayer && (
        <VideoPlayer
          video={playerIVideo}
          listAnimeData={listAnimeData}
          episodesInfo={episodesInfo}
          animeEpisodeNumber={1}
          show={showPlayer}
          loading={loading}
          onLocalProgressChange={() => {}} // no need to local update anything in slideshow
          onChangeLoading={handleChangeLoading}
          onClose={() => {
            setShowPlayer(false);
          }}
        />
      )}
      {listAnimeData && hasModalBeenShowed && (
        <AnimeModal
          listAnimeData={listAnimeData}
          show={showModal}
          onClose={() => setShowModal(false)}
        />
      )}
      <div className="slide">
        <div
          className={`shadow-overlay fade-in ${shadowAnimationClasses}`}
          // style={{ display: isVisible ? 'block' : 'none' }}
        >
          {/* <div className="score">
            <span style={{ color: '#e5a639' }}>
              <FontAwesomeIcon
                className="i"
                icon={faStar}
                style={{ marginRight: 7 }}
              />
              {listAnimeData.media.meanScore}%
            </span>
          </div> */}
          <div className={`content show`}>
            <div className="anime-info">
              <div className="anime-format">{listAnimeData.media.format}</div>•
              <div className="anime-year">
                {capitalizeFirstLetter(listAnimeData.media.season ?? '?')}{' '}
                {getParsedSeasonYear(listAnimeData.media)}
              </div>
              •
              <div className="anime-episodes">
                {getAvailableEpisodes(listAnimeData.media)} Episodes
              </div>
            </div>
            <div className="anime-title">{getTitle(listAnimeData.media)}</div>
            <div
              className="anime-description"
              dangerouslySetInnerHTML={{
                __html: DOMPurify.sanitize(
                  parseDescription(listAnimeData.media.description ?? ''),
                ),
              }}
            ></div>
            <div className="buttons">
              <ButtonMain
                text="Watch now"
                icon={faPlay}
                tint="primary"
                shadow
                onClick={handlePressButton}
              />
              <ButtonMain
                text="More info"
                icon={faArrowUpRightFromSquare}
                tint="light"
                shadow
                onClick={() => {
                  setShowModal(true);
                  if (!hasModalBeenShowed) setHasModalBeenShowed(true);
                }}
              />
              <IsInListButton listAnimeData={listAnimeData} />
            </div>
          </div>
        </div>
        <img
          key={index}
          src={listAnimeData.media.bannerImage}
          alt={`Slide ${index}`}
        />
      </div>
      <Toaster />
    </>
  );
};

interface SlideshowProps {
  listAnimeData?: ListAnimeData[];
}

const Slideshow: React.FC<SlideshowProps> = ({ listAnimeData }) => {
  const [currentIndex, setCurrentIndex] = useState<number>(0);

  const [animeData, setAnimeData] = useState<ListAnimeData[] | undefined>();

  useEffect(() => {
    setAnimeData(
      listAnimeData
        ?.filter((animeData) => animeData?.media.bannerImage)
        ?.filter((animeData) => !animeData.media.mediaListEntry)
        .slice(0, 5),
    );
  }, [listAnimeData]);

  useEffect(() => {
    const intervalId = setInterval(goToNext, 12500);

    return () => clearInterval(intervalId);
  }, [animeData, currentIndex]);

  const goToPrevious = () => {
    if (!animeData) return;
    const newIndex =
      currentIndex === 0 ? animeData.length - 1 : currentIndex - 1;
    setCurrentIndex(newIndex);
  };

  const goToNext = () => {
    if (!animeData) return;
    const newIndex =
      currentIndex === animeData.length - 1 ? 0 : currentIndex + 1;
    setCurrentIndex(newIndex);
  };

  const goToIndex = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <>
      {/* <h1>Discover</h1> */}
      {listAnimeData ? (
        <div className="slideshow-container">
          <div
            className="slideshow-wrapper"
            style={{ transform: `translateX(-${currentIndex * 100}%)` }}
          >
            {animeData &&
              animeData.map((listAnimeData, index) => (
                <Slide
                  key={index}
                  listAnimeData={listAnimeData}
                  index={index}
                  isVisible={index === currentIndex}
                />
              ))}
          </div>
          <div className="dot-container">
            {animeData &&
              animeData.map((_, index) => (
                <span
                  key={index}
                  className={index === currentIndex ? 'dot active' : 'dot'}
                  onClick={() => goToIndex(index)}
                ></span>
              ))}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 25 }}>
          <Skeleton className="slideshow-container" />
        </div>
      )}
    </>
  );
};

export default Slideshow;
