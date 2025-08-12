// import { createEffect, createSignal, onMount, type Component } from "solid-js";
// import {
//   agent,
//   did,
//   getAuthedSkywellClient,
//   isLoggedIn,
// } from "./Auth.tsx";
// import { toast } from "solid-toast";
// import { DevSkywellGetActorProfile } from "skywell";

// const Sidebar: Component = () => {

//   return (
//     <div class="md:w-1/12 items-center flex flex-col md:visible invisible w-0 h-full bg-gray-800 text-white md:p-4 p-0">
//       {loading() ? (
//         <div class="flex items-center justify-center h-full">
//           <span class="text-gray-400">Loading...</span>
//         </div>
//       ) : loggedIn() ? (
//         <>
//           <a href="/account" class="flex flex-col items-center">
//             {/* Profile Picture */}
//             <img
//               src={pfpUri() || "/default-avatar.png"}
//               alt="Profile"
//               class="w-16 h-16 object-cover mb-2"
//             />

//             {/* Display Name */}
//             <span class="text-sm text-center mb-4 break-words">
//               {displayName()}
//             </span>
//           </a>

//           {/* Upload Link */}
//           <a
//             href="/upload"
//             class="text-blue-400 hover:text-blue-300 text-sm underline"
//           >
//             Upload
//           </a>
//         </>
//       ) : (
//         <div class="text-center text-sm text-gray-400">
//           <p>
//             Please <a href="/login">log in</a> to access your profile.
//           </p>
//         </div>
//       )}
//     </div>
//   );
// };

// export default Sidebar;
