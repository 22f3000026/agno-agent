"use client";
import { useState, useEffect } from "react";
import { Client, Account, Teams, Functions } from "appwrite";
import { useRouter } from "next/navigation";
import React from "react";
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
} from "@heroui/react";
import { Button } from "@heroui/button";

// Initialize Appwrite
const client = new Client()
  .setEndpoint("https://cloud.appwrite.io/v1")
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID);

const account = new Account(client);
const teams = new Teams(client);
const functions = new Functions(client);

export default function TeacherDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [spaces, setSpaces] = useState([]);
  const [selectedSpace, setSelectedSpace] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [currentSpace, setCurrentSpace] = useState(null);
  const [newSpaceName, setNewSpaceName] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [teamMembers, setTeamMembers] = useState({});
  const [spaceMembers, setSpaceMembers] = useState([]);
  const [activeTab, setActiveTab] = useState("manage");
  const [allSpaces, setAllSpaces] = useState([]);
  const [joinCode, setJoinCode] = useState("");
  const [joinError, setJoinError] = useState("");
  const [joinSuccess, setJoinSuccess] = useState("");
  const [selected, setSelected] = React.useState("manage");
  const [showJoinCard, setShowJoinCard] = useState(false);
  const joinModal = useDisclosure();

  useEffect(() => {
    const getUser = async () => {
      try {
        const userData = await account.get();

        if (userData?.prefs?.role !== "teacher") {
          router.push("/dashboard");

          return;
        }
        setUser(userData);
        await fetchSpaces();
      } catch (error) {
        console.error("Error fetching user:", error);
        router.push("/");
      } finally {
        setLoading(false);
      }
    };

    getUser();
  }, [router]);

  // Helper to check if user is owner of a team
  const isOwner = (team) => {
    // Find the user's membership for this team
    const memberships = team.memberships || [];

    return memberships.some(
      (m) => m.userId === user?.$id && m.roles.includes("owner"),
    );
  };

  // Helper to check if user is a member of a team
  const isMember = (team) => {
    const memberships = team.memberships || [];

    return memberships.some((m) => m.userId === user?.$id);
  };

  const fetchSpaces = async () => {
    try {
      const response = await teams.list();
      // For each team, fetch memberships and attach to team object
      const teamsWithMemberships = await Promise.all(
        response.teams.map(async (team) => {
          try {
            const memberships = await teams.listMemberships(team.$id);

            return { ...team, memberships: memberships.memberships };
          } catch (error) {
            return { ...team, memberships: [] };
          }
        }),
      );

      setSpaces(teamsWithMemberships);
      // Fetch members count for each team
      const membersPromises = teamsWithMemberships.map(async (team) => {
        try {
          return { id: team.$id, total: team.memberships.length };
        } catch (error) {
          return { id: team.$id, total: 0 };
        }
      });
      const membersCounts = await Promise.all(membersPromises);

      setTeamMembers(
        Object.fromEntries(membersCounts.map((m) => [m.id, m.total])),
      );
    } catch (error) {
      console.error("Error fetching spaces:", error);
      setError("Failed to fetch learning spaces");
    }
  };

  const fetchSpaceMembers = async (spaceId) => {
    try {
      const response = await teams.listMemberships(spaceId);

      setSpaceMembers(response.memberships);
    } catch (error) {
      console.error("Error fetching space members:", error);
      setError("Failed to fetch space members");
    }
  };

  const handleCreateSpace = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      const joinCode = Math.floor(100000 + Math.random() * 900000).toString();
      const team = await teams.create(joinCode, newSpaceName);

      await teams.updatePrefs(team.$id, {
        joinCode: joinCode,
        createdAt: new Date().toISOString(),
      });

      setSuccess("Learning space created successfully!");
      setShowCreateModal(false);
      setNewSpaceName("");
      await fetchSpaces();
    } catch (error) {
      console.error("Error creating space:", error);
      setError(error.message || "Failed to create learning space");
    }
  };

  const handleEditSpace = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    try {
      await teams.update(currentSpace.$id, newSpaceName);
      setSuccess("Learning space updated successfully!");
      setShowEditModal(false);
      setCurrentSpace(null);
      setNewSpaceName("");
      await fetchSpaces();
      if (selectedSpace?.$id === currentSpace.$id) {
        setSelectedSpace({ ...selectedSpace, name: newSpaceName });
      }
    } catch (error) {
      console.error("Error updating space:", error);
      setError(error.message || "Failed to update learning space");
    }
  };

  const handleDeleteSpace = async () => {
    setError("");
    setSuccess("");

    try {
      await teams.delete(currentSpace.$id);
      setSuccess("Learning space deleted successfully!");
      setShowDeleteModal(false);
      setCurrentSpace(null);
      if (selectedSpace?.$id === currentSpace.$id) {
        setSelectedSpace(null);
      }
      await fetchSpaces();
    } catch (error) {
      console.error("Error deleting space:", error);
      setError(error.message || "Failed to delete learning space");
    }
  };

  const handleSpaceClick = async (space) => {
    setSelectedSpace(space);
    await fetchSpaceMembers(space.$id);
  };

  const handleLogout = async () => {
    try {
      await account.deleteSession("current");
      router.push("/");
    } catch (error) {
      console.error("Error logging out:", error);
    }
  };

  // Fetch all spaces for Explore tab
  const fetchAllSpaces = async () => {
    try {
      const response = await teams.list();

      setAllSpaces(response.teams);
    } catch (error) {
      console.error("Error fetching all spaces:", error);
    }
  };

  // Fetch all spaces when Explore tab is selected
  useEffect(() => {
    if (activeTab === "explore") {
      fetchAllSpaces();
    }
  }, [activeTab]);

  // Join space by code
  const handleJoinSpace = async () => {
    setJoinError("");
    setJoinSuccess("");
    if (!joinCode || joinCode.length !== 6) {
      setJoinError("Please enter a valid 6-digit code.");

      return;
    }
    try {
      // Start the function execution
      const execution = await functions.createExecution(
        "joinTeam",
        JSON.stringify({
          joinCode: joinCode,
          userId: user.$id,
          userEmail: user.email, // send email for fallback
        }),
        false,
      );

      // Poll for the result
      let execStatus;
      let attempts = 0;

      while (attempts < 10) {
        // up to ~5 seconds
        execStatus = await functions.getExecution("joinTeam", execution.$id);
        if (
          execStatus.status === "completed" ||
          execStatus.status === "failed"
        ) {
          break;
        }
        await new Promise((res) => setTimeout(res, 500));
        attempts++;
      }

      if (!execStatus) {
        setJoinError("No response from server. Please try again.");

        return;
      }

      if (execStatus.status === "completed") {
        setJoinSuccess("Joined successfully!");
        setJoinCode("");
        setTimeout(fetchSpaces, 2000);
      } else if (execStatus.status === "failed") {
        setJoinError("Failed to join space. Function execution failed.");
      } else {
        setJoinError("No response from server. Please try again.");
      }
    } catch (err) {
      console.error("Error joining space:", err);
      setJoinError("Failed to join space. Please try again.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="text-lg text-slate-600 dark:text-slate-300 flex items-center gap-2">
          <span className="animate-spin">🔄</span> Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
      {/* Navbar */}
      <nav className="bg-white/90 backdrop-blur-md dark:bg-slate-800/90 border-b border-slate-200/50 dark:border-slate-700/50 sticky top-0 z-50 relative">
        <div className="container mx-auto px-4 relative">
          <div className="flex items-center justify-between h-16 relative">
            <div className="flex items-center gap-2 z-10">
              <span className="text-2xl">⚡</span>
              <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">
                proSpace
              </span>
            </div>
            <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-0">
              <Tabs
                aria-label="Dashboard Options"
                className=""
                selectedKey={selected}
                onSelectionChange={setSelected}
              >
                <Tab key="my" title="My Spaces" />
                <Tab key="manage" title="Manage Spaces" />
              </Tabs>
            </div>
            <div className="flex items-center space-x-4 z-10">
              <div className="flex items-center space-x-3">
                <div className="text-right">
                  <p className="text-sm font-medium text-slate-900 dark:text-white flex items-center gap-2">
                    <span>👨‍🏫</span>
                    {user?.name}
                  </p>
                </div>
                <Button
                  className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white gap-2 flex items-center"
                  variant="ghost"
                  onClick={handleLogout}
                >
                  <span>🚪</span> Logout
                </Button>
              </div>
            </div>
          </div>
        </div>
      </nav>

      <main className="px-0 py-0">
        {selected === "my" && (
          <Card className="w-full h-[calc(100vh-4rem)] flex flex-col rounded-none shadow-none border-0 px-0">
            <CardBody className="flex-1 flex flex-col overflow-y-auto px-0 pb-0">
              <div className="flex flex-col items-center mb-8 pt-8 px-8">
                <Button
                  className="mb-6 font-semibold"
                  color="primary"
                  onClick={joinModal.onOpen}
                >
                  + Join Space
                </Button>
              </div>
              <Modal
                isOpen={joinModal.isOpen}
                onOpenChange={joinModal.onOpenChange}
              >
                <ModalContent>
                  {(onClose) => (
                    <>
                      <ModalHeader className="flex flex-col gap-1">
                        Join a Space
                      </ModalHeader>
                      <ModalBody>
                        <p className="text-slate-600 dark:text-slate-300 mb-4 text-center">
                          Enter a 6-digit code to join a learning space.
                        </p>
                        <input
                          className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-slate-700 dark:text-white text-center text-lg tracking-widest mb-4"
                          maxLength={6}
                          placeholder="Enter code"
                          type="text"
                          value={joinCode}
                          onChange={(e) =>
                            setJoinCode(
                              e.target.value.replace(/\D/g, "").slice(0, 6),
                            )
                          }
                        />
                        {joinError && (
                          <div className="text-red-600 dark:text-red-400 text-center text-sm mb-2">
                            {joinError}
                          </div>
                        )}
                        {joinSuccess && (
                          <div className="text-green-600 dark:text-green-400 text-center text-sm mb-2">
                            {joinSuccess}
                          </div>
                        )}
                      </ModalBody>
                      <ModalFooter>
                        <Button
                          color="danger"
                          variant="light"
                          onPress={() => {
                            onClose();
                            setJoinCode("");
                            setJoinError("");
                            setJoinSuccess("");
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          color="primary"
                          onPress={() => {
                            handleJoinSpace();
                          }}
                        >
                          Join
                        </Button>
                      </ModalFooter>
                    </>
                  )}
                </ModalContent>
              </Modal>
              {spaces.filter(isMember).length === 0 ? (
                <p className="text-center text-slate-600 dark:text-slate-300">
                  You have not joined any spaces yet.
                </p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 px-8 pb-8">
                  {spaces.filter(isMember).map((space) => (
                    <Card
                      key={space.$id}
                      className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-all p-6"
                    >
                      <CardBody
                        className="cursor-pointer"
                        role="button"
                        tabIndex={0}
                        onClick={() =>
                          router.push(`/dashboard/myspace/${space.$id}`)
                        }
                        onKeyPress={(e) => {
                          if (e.key === "Enter")
                            router.push(`/dashboard/myspace/${space.$id}`);
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                            {space.name}
                          </h3>
                          <span className="text-xs px-2 py-1 bg-indigo-100 dark:bg-indigo-900 text-indigo-700 dark:text-indigo-200 rounded-full">
                            {space.memberships
                              .find((m) => m.userId === user?.$id)
                              ?.roles.join(", ") || "Member"}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-sm">
                          <span className="text-slate-500 dark:text-slate-400">
                            {teamMembers[space.$id] || 0} members
                          </span>
                          <span className="text-slate-400 dark:text-slate-500">
                            Code: {space.prefs?.joinCode}
                          </span>
                        </div>
                      </CardBody>
                    </Card>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        )}
        {selected === "manage" && (
          <Card className="w-full h-[calc(100vh-4rem)] flex flex-col rounded-none shadow-none border-0 px-0">
            <CardBody className="flex-1 flex flex-col overflow-y-auto px-0 pb-0">
              <div className="flex flex-col h-full px-8 pt-8 pb-8">
                <div className="flex justify-between items-center mb-8">
                  <div>
                    <h1 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                      Learning Spaces
                    </h1>
                    <p className="text-slate-600 dark:text-slate-300">
                      Create and manage your learning spaces
                    </p>
                  </div>
                  <Button
                    className="font-semibold"
                    color="primary"
                    onClick={() => setShowCreateModal(true)}
                  >
                    + Create Space
                  </Button>
                </div>
                {error && (
                  <div className="mb-6 p-4 bg-red-50 text-red-700 rounded-lg dark:bg-red-900/50 dark:text-red-200">
                    {error}
                  </div>
                )}
                {success && (
                  <div className="mb-6 p-4 bg-green-50 text-green-700 rounded-lg dark:bg-green-900/50 dark:text-green-200">
                    {success}
                  </div>
                )}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  <div className="lg:col-span-1 space-y-4">
                    {spaces.filter(isOwner).length === 0 ? (
                      <div className="text-center py-12">
                        <div className="mb-4 text-4xl">🏫</div>
                        <p className="text-slate-600 dark:text-slate-300">
                          No learning spaces created yet. Create your first
                          space to get started!
                        </p>
                      </div>
                    ) : (
                      spaces.filter(isOwner).map((space) => (
                        <Card
                          key={space.$id}
                          className={`bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 hover:shadow-md transition-all ${selectedSpace?.$id === space.$id ? "ring-2 ring-indigo-500 dark:ring-indigo-400" : ""}`}
                        >
                          <CardBody
                            className="cursor-pointer"
                            role="button"
                            tabIndex={0}
                            onClick={() => handleSpaceClick(space)}
                            onKeyPress={(e) => {
                              if (e.key === "Enter") handleSpaceClick(space);
                            }}
                          >
                            <div className="flex justify-between items-start">
                              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                                {space.name}
                              </h3>
                              <div className="flex items-center gap-2">
                                <Button
                                  className="p-1"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentSpace(space);
                                    setNewSpaceName(space.name);
                                    setShowEditModal(true);
                                  }}
                                >
                                  ✏️
                                </Button>
                                <Button
                                  className="p-1 text-red-600"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setCurrentSpace(space);
                                    setShowDeleteModal(true);
                                  }}
                                >
                                  🗑️
                                </Button>
                              </div>
                            </div>
                            <div className="mt-2 flex items-center justify-between text-sm">
                              <span className="text-slate-500 dark:text-slate-400">
                                {teamMembers[space.$id] || 0} members
                              </span>
                              <span className="text-slate-400 dark:text-slate-500">
                                Code: {space.prefs?.joinCode}
                              </span>
                            </div>
                          </CardBody>
                        </Card>
                      ))
                    )}
                  </div>
                  <div className="lg:col-span-2">
                    {selectedSpace ? (
                      <Card className="bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 p-6">
                        <CardBody>
                          <div className="flex justify-between items-start mb-6">
                            <div>
                              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">
                                {selectedSpace.name}
                              </h2>
                              <p className="text-slate-600 dark:text-slate-300">
                                Created on{" "}
                                {new Date(
                                  selectedSpace.prefs?.createdAt,
                                ).toLocaleDateString()}
                              </p>
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                                {teamMembers[selectedSpace.$id] || 0} members
                              </span>
                              <Button
                                className="px-4 py-2"
                                color="primary"
                                onClick={() =>
                                  router.push(
                                    `/dashboard/space/${selectedSpace.$id}`,
                                  )
                                }
                              >
                                Enter Space
                              </Button>
                            </div>
                          </div>
                          <div className="space-y-6">
                            {/* Quick Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <Card className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                                <CardBody>
                                  <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                    Active Students
                                  </h3>
                                  <p className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
                                    {
                                      spaceMembers.filter(
                                        (m) => m.roles[0] === "student",
                                      ).length
                                    }
                                  </p>
                                </CardBody>
                              </Card>
                              <Card className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                                <CardBody>
                                  <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                    Total Chapters
                                  </h3>
                                  <p className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
                                    0
                                  </p>
                                </CardBody>
                              </Card>
                              <Card className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                                <CardBody>
                                  <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-1">
                                    Flashcards
                                  </h3>
                                  <p className="text-2xl font-semibold text-indigo-600 dark:text-indigo-400">
                                    0
                                  </p>
                                </CardBody>
                              </Card>
                            </div>
                            {/* Join Code Section */}
                            <Card className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-4">
                              <CardBody>
                                <h3 className="text-sm font-medium text-slate-900 dark:text-white mb-2">
                                  Join Code
                                </h3>
                                <div className="flex items-center gap-2">
                                  <code className="px-3 py-2 bg-white dark:bg-slate-800 rounded-lg text-lg font-mono">
                                    {selectedSpace.prefs?.joinCode}
                                  </code>
                                  <Button
                                    className="p-2"
                                    variant="ghost"
                                    onClick={() => {
                                      navigator.clipboard.writeText(
                                        selectedSpace.prefs?.joinCode,
                                      );
                                      setSuccess(
                                        "Join code copied to clipboard!",
                                      );
                                    }}
                                  >
                                    📋
                                  </Button>
                                </div>
                              </CardBody>
                            </Card>
                            {/* Members Section */}
                            <Card>
                              <CardBody>
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
                                  Members
                                </h3>
                                <div className="space-y-3">
                                  {spaceMembers.map((member) => (
                                    <div
                                      key={member.$id}
                                      className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg"
                                    >
                                      <div className="flex items-center gap-3">
                                        <span className="text-lg">👤</span>
                                        <div>
                                          <p className="font-medium text-slate-900 dark:text-white">
                                            {member.userName}
                                          </p>
                                          <p className="text-sm text-slate-600 dark:text-slate-300">
                                            {member.userEmail}
                                          </p>
                                        </div>
                                      </div>
                                      <span className="text-xs font-medium px-2 py-1 rounded-full bg-slate-200 text-slate-700 dark:bg-slate-600 dark:text-slate-200">
                                        {member.roles[0]}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </CardBody>
                            </Card>
                          </div>
                        </CardBody>
                      </Card>
                    ) : (
                      <Card className="h-full flex items-center justify-center bg-white/90 dark:bg-slate-800/90 border border-slate-200/50 dark:border-slate-700/50 p-6">
                        <CardBody>
                          <div className="text-center">
                            <div className="mb-4 text-4xl">👈</div>
                            <p className="text-slate-600 dark:text-slate-300">
                              Select a learning space to view its details
                            </p>
                          </div>
                        </CardBody>
                      </Card>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>
        )}
      </main>

      {/* Create Space Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Create Learning Space
            </h2>
            <form onSubmit={handleCreateSpace}>
              <div className="mb-4">
                <label
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                  htmlFor="create-space-name"
                >
                  Space Name
                </label>
                <input
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  id="create-space-name"
                  placeholder="Enter space name"
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewSpaceName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  type="submit"
                >
                  Create Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Space Modal */}
      {showEditModal && currentSpace && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Edit Learning Space
            </h2>
            <form onSubmit={handleEditSpace}>
              <div className="mb-4">
                <label
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2"
                  htmlFor="edit-space-name"
                >
                  Space Name
                </label>
                <input
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  id="edit-space-name"
                  placeholder="Enter space name"
                  type="text"
                  value={newSpaceName}
                  onChange={(e) => setNewSpaceName(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  type="button"
                  onClick={() => {
                    setShowEditModal(false);
                    setCurrentSpace(null);
                    setNewSpaceName("");
                  }}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  type="submit"
                >
                  Update Space
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Space Modal */}
      {showDeleteModal && currentSpace && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md shadow-xl">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-4">
              Delete Learning Space
            </h2>
            <p className="text-slate-600 dark:text-slate-300 mb-6">
              Are you sure you want to delete &quot;{currentSpace.name}&quot;?
              This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                onClick={() => {
                  setShowDeleteModal(false);
                  setCurrentSpace(null);
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                onClick={handleDeleteSpace}
              >
                Delete Space
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
