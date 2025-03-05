import io from "socket.io-client";
import client from "axios";
import toast, { Toaster } from "react-hot-toast";
import { Fragment, useEffect, useRef, useState } from "react";
import {
  ArchiveIcon,
  CloudUpload,
  Download,
  Fullscreen,
  PlusIcon,
  Save,
  Trash,
  X,
} from "lucide-react";
import empty_1 from "../assets/empty_1.png";
import empty_2 from "../assets/empty_2.png";

export function meta() {
  return [{ title: "Pastebin" }];
}

const EVENT_TARGET_ENUM = {
  TITLE: "title",
  CONTENT: "content",
};

const INITIAL_PASTE_DATA = {
  id: null,
  title: "",
  content: "",
  created_at: null,
  archived: 0,
};

const UploadedFile = ({
  archive,
  handleArchiveDownload,
  handleArchiveDelete,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);
  return (
    <li className="w-full bg-white rounded-xl" key={archive.id}>
      {/* File Input */}
      <label className="w-full p-6 gap-4 flex justify-between items-center border-2 border-gray-300 rounded-xl">
        <div className="text-gray-600 whitespace-nowrap w-10/12 overflow-hidden">
          <span className="font-semibold">{archive.title}</span>
          <br />
          <span>{new Date(archive.created_at).toLocaleString("it-IT")}</span>
        </div>
        <div className="flex items-baseline gap-4">
          {!isDownloading ? (
            <Download
              onClick={() =>
                handleArchiveDownload(
                  archive.id,
                  archive.title,
                  setIsDownloading
                )
              }
              className="w-7 h-7 text-blue-600 hover:text-blue-700 transition cursor-pointer mb-2"
            />
          ) : (
            <div className="flex items-center justify-center">
              <div className="w-7 h-7 border-4 border-blue-300 border-t-blue-900 rounded-full animate-spin"></div>
            </div>
          )}

          <Trash
            onClick={() => handleArchiveDelete(archive.id)}
            className="w-7 h-7 text-red-600 hover:text-red-700 transition cursor-pointer mb-2"
            size={8}
          />
        </div>
      </label>
    </li>
  );
};

export default function Home() {
  const socketRef = useRef(null);
  const selectedPasteRef = useRef(null);
  const currentValueRef = useRef(null);

  const [selectedPaste, setSelectedPaste] = useState(null);
  const [currentACS, setCurrentACS] = useState(1);
  const [pendingChanges, setPendingChanges] = useState(0);
  const [pasteItems, setPasteItems] = useState([]);
  const [archiveItems, setArchiveItems] = useState([]);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullScreen, setFullScreen] = useState(false);
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  const handlePastePublish = async (body) => {
    try {
      const { data } = await client.post(
        import.meta.env.VITE_API_ENDPOINT + "/clipboard",
        { ...body, client_id: socketRef.current.id }
      );

      setPasteItems((state) => [...state, data]);
      setSelectedPaste(data);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePasteDelete = async (id) => {
    try {
      await client.delete(`${import.meta.env.VITE_API_ENDPOINT}/clipboard`, {
        params: {
          client_id: socketRef.current.id,
          id,
        },
      });

      setPasteItems((state) => state.filter((item) => item.id !== id));

      setSelectedPaste(null);
      setFullScreen(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handlePasteDeleteEvent = (payload) => {
    setPasteItems((state) => state.filter((item) => item.id !== payload));

    if (!selectedPasteRef.current) return;

    if (selectedPasteRef.current.id == payload) {
      setSelectedPaste((state) => ({
        ...state,
        id: null,
        created_at: null,
      }));
      toast.success(
        "Questi appunti sono stati eliminati da un altro utente. Stai ora lavorando su una versione locale."
      );
      return;
    }
  };

  const handlePasteUpdateEvent = (payload) => {
    setPasteItems((state) =>
      state.map((item) => {
        if (item.id === payload.id) {
          return {
            ...item,
            [payload.target]: payload.value,
          };
        }
        return item;
      })
    );

    if (!selectedPasteRef.current?.id) return;

    setSelectedPaste((state) => {
      let localChunks = {};
      let chunkCount = 0;

      for (
        let index = 0;
        index < state[payload.target].length;
        index += payload.acs
      ) {
        localChunks[index] = state[payload.target].slice(
          index,
          index + payload.acs
        );
        chunkCount++;
      }

      for (const key of Object.keys(payload.value)) {
        if (!payload.value[key]) delete localChunks[key];

        localChunks[key] = payload.value[key];
      }

      const updatedString = Object.values(localChunks).join("");

      return {
        ...state,
        [payload.target]: updatedString,
      };
    });
  };

  const handlePasteWriteEvent = (payload) => {
    if (
      !selectedPasteRef.current?.id ||
      payload.i != selectedPasteRef.current.id
    )
      return;

    setCurrentACS(payload.a);
    setSelectedPaste((state) => {
      let localChunks = {};

      for (let seq = 0; seq < state.content.length; seq += payload.a) {
        localChunks[seq] = state.content.slice(seq, seq + payload.a);
      }

      for (const key of Object.keys(payload.p)) {
        if (!payload.p[key]) delete localChunks[key];

        localChunks[key] = payload.p[key];
      }

      const updatedString = Object.values(localChunks).join("");

      return {
        ...state,
        content: updatedString,
      };
    });
  };

  const handleInitialLoad = async (body) => {
    setIsLoading(true);
    try {
      Promise.all([
        await client
          .get(import.meta.env.VITE_API_ENDPOINT + "/clipboard/all")
          .then(({ data }) => setPasteItems(data)),
        await client
          .get(import.meta.env.VITE_API_ENDPOINT + "/archive/all")
          .then(({ data }) => setArchiveItems(data)),
        ,
      ]);
    } catch (error) {
      console.error(error);
    }
    if (!isInitialLoadComplete) setIsInitialLoadComplete(true);
    setIsLoading(false);
  };

  const handleArchiveUplaod = async (data) => {
    setIsUploading(true);
    const payload = new FormData();
    payload.append("file", data);
    try {
      const { data } = await client.post(
        `${import.meta.env.VITE_API_ENDPOINT}/archive`,
        payload,
        { params: { client_id: socketRef.current.id } }
      );

      setArchiveItems((state) => [...state, data]);
    } catch (error) {
      toast.error("Caricamento non riuscito. Il file non deve superare 1GB");
    }
    setIsUploading(false);
    setFile(null);
  };

  const handleArchiveDownload = async (id, fileName, onDownloadEvent) => {
    onDownloadEvent(true);

    try {
      const { data } = await client.get(
        `${import.meta.env.VITE_API_ENDPOINT}/archive/download`,
        { params: { id }, responseType: "blob" }
      );

      const url = window.URL.createObjectURL(new Blob([data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      toast.error("Download non riuscito. Riprova tra qualche secondo");
      console.error(error);
    }
    onDownloadEvent(false);
  };

  const handleArchiveDelete = async (id) => {
    try {
      await client.delete(`${import.meta.env.VITE_API_ENDPOINT}/archive`, {
        params: { id, client_id: socketRef.current.id },
      });

      setArchiveItems((state) => state.filter((item) => item.id !== id));
    } catch (error) {
      console.error(error);
    }
  };

  const handleContentUpdate = (prevValue, value, id) => {
    console.log(pendingChanges, currentACS);
    if (pendingChanges < currentACS) {
      setPendingChanges(pendingChanges + 1);
      if (currentACS < 100) emitWriteEvent(prevValue, value, id);
      return;
    }

    emitUpdateEvent(EVENT_TARGET_ENUM.CONTENT, value, id);

    setPendingChanges(0);
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleBlur = (target, value) => {
    emitUpdateEvent(target, value, selectedPasteRef.current.id);
    setPendingChanges(0);
    setCurrentACS(1);
  };

  const emitWriteEvent = (prevValue, value, id) => {
    if (!selectedPasteRef.current?.id) return;

    if (prevValue == value) return;

    const adaptiveChunkSize = Math.floor(parseInt(prevValue?.length / 100)) + 1;
    setCurrentACS(adaptiveChunkSize);

    let compareChunks = {};
    let updatedChunks = {};
    let updatesToApply = {};

    for (
      let seq = 0;
      seq < Math.max(prevValue?.length, value?.length);
      seq += adaptiveChunkSize
    ) {
      compareChunks[seq] = prevValue?.slice(seq, seq + adaptiveChunkSize);
      updatedChunks[seq] = value?.slice(seq, seq + adaptiveChunkSize);

      if (updatedChunks[seq] == compareChunks[seq]) continue;

      if (!updatedChunks[seq]) {
        updatesToApply[seq] = null;
        continue;
      }

      updatesToApply[seq] = updatedChunks[seq];
    }

    for (const key of Object.keys(updatedChunks).filter(
      (key) => !Object.keys(compareChunks).includes(key)
    )) {
      updatesToApply[key] = updatedChunks[key];
    }

    const payload = {
      i: id,
      p: updatesToApply,
      c: socketRef.current.id,
      a: adaptiveChunkSize,
    };

    socketRef.current.emit("write_paste", payload);
  };

  const emitUpdateEvent = (target, value, id) => {
    if (!selectedPaste?.id) return;

    const payload = {
      target,
      value,
      id,
      client_id: socketRef.current.id,
    };

    setPasteItems((state) =>
      state.map((item) => {
        if (item.id === payload.id)
          return { ...item, [payload.target]: payload.value };
        return item;
      })
    );
    socketRef.current.emit("edit_paste", payload);
  };

  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io(import.meta.env.VITE_API_ENDPOINT, {
        transports: ["websocket"],
      });

      socketRef.current.on("connect", () => {
        handleInitialLoad();
      });

      socketRef.current.on("disconnect", () => {
        setIsLoading(true);
      });

      socketRef.current.on("new_paste", (payload) => {
        setPasteItems((state) => [...state, payload]);
      });

      socketRef.current.on("new_archive", (payload) => {
        setArchiveItems((state) => [...state, payload]);
      });

      socketRef.current.on("delete_archive", (payload) => {
        setArchiveItems((state) => state.filter((item) => item.id !== payload));
      });

      socketRef.current.on("delete_paste", (payload) => {
        handlePasteDeleteEvent(payload);
      });

      socketRef.current.on("update_paste", (payload) => {
        handlePasteUpdateEvent(payload);
      });

      socketRef.current.on("incremental_write_paste", (payload) => {
        handlePasteWriteEvent(payload);
      });
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (file) handleArchiveUplaod(file);
  }, [file]);

  useEffect(() => {
    selectedPasteRef.current = selectedPaste;
  }, [selectedPaste]);

  return (
    <Fragment>
      <Toaster toastOptions={{ duration: 5000 }} />
      <div
        className={`${
          isLoading ? "opacity-100" : "opacity-0 pointer-events-none"
        } fixed inset-0 flex items-center justify-center transition-opacity duration-500 bg-white/70 z-50`}
      >
        <div className="flex flex-col items-center opacity-100">
          <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
          <p className="text-lg font-semibold text-gray-700">Sincronizzo...</p>
        </div>
      </div>
      {/* )} */}

      <div className="bg-fixed inset-0 min-h-screen bg-gray-100">
        {isInitialLoadComplete && (
          <div className="flex flex-col xl:flex-row h-max xl:h-screen gap-8 xl:gap-4 p-4 py-12">
            {!isFullScreen && (
              <div className="w-full xl:min-w-3/12 flex-1 bg-white p-4 xl:p-6 rounded-xl shadow-xl">
                <div className="flex flex-col justify-between h-full gap-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Appunti
                  </h2>
                  {pasteItems.length == 0 && (
                    <div className="h-full grid place-content-center">
                      <img
                        className="aspect-square h-56 grayscale opacity-70"
                        src={empty_1}
                      />
                    </div>
                  )}
                  <ul className="space-y-3 overflow-y-auto grow">
                    {pasteItems.map((item) => (
                      <li
                        key={item.id}
                        onClick={() => setSelectedPaste(item)}
                        className={`p-3 hover:bg-gray-400 rounded-xl text-gray-700 font-semibold cursor-pointer transition ${
                          selectedPaste?.id === item.id
                            ? "bg-sky-300"
                            : "bg-gray-200"
                        }`}
                      >
                        {item.title.slice(0, 30) || "Appunti senza nome"}
                      </li>
                    ))}
                  </ul>
                  <div className="space-y-3 ">
                    <button
                      onClick={() => setSelectedPaste(INITIAL_PASTE_DATA)}
                      className="p-3 w-full bg-sky-600 hover:bg-sky-800 rounded-xl text-white font-semibold transition flex justify-center cursor-pointer gap-4"
                    >
                      Crea nuovo blocco <PlusIcon />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedPaste && (
              <div className="w-full xl:min-w-4/12 flex flex-col items-center justify-center h-full">
                <div className="w-full bg-white p-4 xl:p-6 rounded-xl shadow-xl flex flex-col gap-4 flex-1">
                  <div className="flex justify-between items-center">
                    <h2 className="text-xl font-semibold text-gray-800">
                      {selectedPaste.created_at
                        ? `Appunti del ${new Date(
                            selectedPaste.created_at
                          ).toLocaleString("it-IT")}`
                        : "Nuova bozza appunti"}
                    </h2>
                    <div className="flex gap-2">
                      <Fullscreen
                        className="cursor-pointer hover:bg-gray-200 rounded-xl p-1"
                        onClick={() => setFullScreen(!isFullScreen)}
                      />
                      {!isFullScreen && (
                        <X
                          className="cursor-pointer hover:bg-gray-200 rounded-xl p-1"
                          onClick={() => setSelectedPaste(null)}
                        />
                      )}
                    </div>
                  </div>

                  <input
                    type="text"
                    value={selectedPaste.title}
                    onChange={(e) => {
                      setSelectedPaste((state) => ({
                        ...state,
                        title: e.target.value,
                      }));
                    }}
                    onBlur={(e) =>
                      handleBlur(EVENT_TARGET_ENUM.TITLE, e.target.value)
                    }
                    className="w-full p-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Inserisci un titolo"
                  />
                  <textarea
                    value={selectedPaste.content}
                    onBeforeInput={(e) => {
                      currentValueRef.current = e.target.value;
                    }}
                    onChange={(e) => {
                      setSelectedPaste((state) => ({
                        ...state,
                        content: e.target.value,
                      }));

                      handleContentUpdate(
                        currentValueRef.current,
                        e.target.value,
                        selectedPasteRef.current.id
                      );
                    }}
                    onBlur={(e) =>
                      handleBlur(EVENT_TARGET_ENUM.CONTENT, e.target.value)
                    }
                    className="w-full p-3 border border-gray-300 rounded-xl h-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                    placeholder="Scrivi qui..."
                    rows={15}
                  ></textarea>

                  {!selectedPaste.id ? (
                    <button
                      className="p-3 bg-sky-600 hover:bg-sky-800 rounded-xl font-semibold text-white cursor-pointer transition flex justify-center gap-4"
                      onClick={() =>
                        handlePastePublish({
                          title: selectedPaste.title,
                          content: selectedPaste.content,
                        })
                      }
                    >
                      Salva appunti
                      <Save />
                    </button>
                  ) : (
                    <button
                      className="p-3 bg-red-400 hover:bg-red-600  text-white rounded-xl font-semibold cursor-pointer transition flex justify-center"
                      onClick={() => handlePasteDelete(selectedPaste.id)}
                    >
                      Archivia questi appunti
                      <ArchiveIcon className="ml-3" />
                    </button>
                  )}
                </div>
              </div>
            )}

            {!isFullScreen && (
              <div className="w-full xl:min-w-4/12 flex-1 bg-white p-4 xl:p-6 rounded-xl shadow-xl">
                <div className="flex flex-col justify-between h-full gap-4">
                  <h2 className="text-xl font-semibold text-gray-800">
                    Documenti
                  </h2>

                  <ul className="overflow-y-auto grow space-y-3 ">
                    {archiveItems.length == 0 && (
                      <div className="h-full grid place-content-center">
                        <img
                          className="aspect-square h-56 grayscale opacity-70"
                          src={empty_2}
                        />
                      </div>
                    )}
                    {archiveItems.map((archive) => (
                      <UploadedFile
                        key={archive.id}
                        archive={archive}
                        handleArchiveDelete={handleArchiveDelete}
                        handleArchiveDownload={handleArchiveDownload}
                      />
                    ))}
                  </ul>

                  <div className="w-full bg-white rounded-xl flex flex-col">
                    {/* File Input */}
                    <label
                      className={`w-full flex flex-col items-center justify-center border-2 border-dashed border-gray-300 rounded-xl ${
                        isUploading
                          ? "animate-pulse"
                          : "cursor-pointer hover:border-blue-400"
                      }`}
                    >
                      <div className="text-gray-600">
                        {isUploading ? (
                          <div className="flex items-center justify-between gap-4 ">
                            <div className="flex items-center justify-center py-4">
                              <div className="w-8 h-8 border-4 border-blue-300 border-t-blue-900 rounded-full animate-spin"></div>
                            </div>
                            <span>Carico {file?.name.slice(0, 35)}...</span>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-4 my-2">
                            <span>Carica un documento</span>
                            <CloudUpload className="w-7 h-7  text-blue-500" />
                          </div>
                        )}
                      </div>
                      <input
                        disabled={isUploading}
                        type="file"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Fragment>
  );
}
