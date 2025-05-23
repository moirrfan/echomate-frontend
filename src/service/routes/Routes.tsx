import React from "react";
import Loader from "components/Loader";
import { useDispatch } from "react-redux";
import PublicRouter from "./PublicRouter";
import PrivateRouter from "./PrivateRouter";
import { useAppSelector } from "src/redux/hooks";
import { onAuthStateChanged } from "firebase/auth";
import { firebaseAuth } from "src/service/firebase";
import {
  setUser,
  setUsers,
  stopLoading,
} from "src/redux/reducers/auth.reducer";

//websockets
import { io } from "socket.io-client";
import { getCollections } from "../api/api.firebase";
import { clearSocket, setSocket } from "src/redux/reducers/socket.reducer";
import { setSnack } from "src/redux/reducers/snack.reducer";

export default function Routes() {
  const dispatch = useDispatch();
  const {
    auth,
    socket: { socket },
  } = useAppSelector((state) => ({
    auth: state.auth,
    socket: state.socket,
  }));

  React.useEffect(() => {
    if (!auth.user && socket) {
      const unsubscribe = onAuthStateChanged(
        firebaseAuth,
        async (currentUser) => {
          if (currentUser) {
            const userObj = {
              displayName: currentUser.displayName || "",
              email: currentUser.email || "",
              photoURL: currentUser.photoURL || "",
              phoneNumber: currentUser.phoneNumber || "",
              accessToken: await currentUser.getIdToken(),
            };
            socket.emit("get-user-by-email-request", userObj);
          }
          console.log(currentUser);
          dispatch(stopLoading());
        }
      );
      return () => unsubscribe();
    }
  }, [auth.user, dispatch, socket]);

  React.useEffect(() => {
    const socketServer = `${import.meta.env.VITE_socket_server}`;
    console.log({ socketServer });
    const socket = io(socketServer, {
      reconnectionDelayMax: 10000,
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      dispatch(setSocket(socket));
    });

    // TODO: SOCKET ID IS CREATING ISSUE
    // socket.on("update-user-response", (user) => {
    //   console.log({ user: user.socket_id, socket: socket.id });
    //   if (user.socket_id !== socket.id) {
    //     dispatch(setUser(user));
    //   }
    // });
    socket.on("get-user-by-email-response", (user) => {
      const obj = {
        ...user,
        socket_id: socket.id,
      };
      dispatch(setUser(obj));
      socket.emit("update-user", obj);
    });

    socket.io.on("error", (error) => {
      // ...
      console.log(error);
    });

    // socket.io.on("ping", () => {
    //   // ...
    //   console.log("ping");
    // });

    // socket.io.on("reconnect", (attempt) => {
    //   // ...
    //   console.log(attempt);
    // });
    socket.on("update-user-error", (error) => {
      // ...
      dispatch(setSnack({ open: true, message: error, type: "error" }));
    });

    socket.on("disconnect", (reason) => {
      dispatch(clearSocket());
      if (reason === "io server disconnect") {
        // the disconnection was initiated by the server, you need to reconnect manually
        socket.connect();
      }
      // else the socket will automatically try to reconnect
    });
  }, [dispatch]);

  React.useEffect(() => {
    if (socket && auth.user) {
      if (socket.id !== auth.user?.socket_id) {
        socket.emit("update-user", {
          ...auth.user,
          socket_id: socket.id,
        });
      }
    }
  }, [socket, auth.user]);

  React.useEffect(() => {
    if (auth.user) {
      getCollections("users")
        .then((res) => {
          dispatch(setUsers(res.filter((user) => user.uid !== auth.user?.uid)));
        })
        .catch((err) => {
          console.log({ err });
        });
    }
  }, [auth.user, dispatch]);

  return (
    <div>
      {auth.loading && <Loader loading />}
      {auth.user && !auth.loading && <PrivateRouter />}
      {!auth.user && !auth.loading && <PublicRouter />}
    </div>
  );
}
