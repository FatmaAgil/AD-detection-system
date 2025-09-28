import React from "react";
import { Camera, Home, MessageSquare, Phone, User } from "lucide-react";
import { Link, useLocation } from "react-router-dom";

const nav = [
	{ name: "Dashboard", path: "/dashboard", icon: Home },
	{ name: "AD Scan", path: "/scan", icon: Camera },
	{ name: "Chat History", path: "/chat", icon: MessageSquare },
	{ name: "Contact", path: "/contact", icon: Phone },
	{ name: "Profile", path: "/profile", icon: User },
];

const COLORS = {
	sidebar: "#1e90e8",
	sidebarActive: "#007bff",
};

export default function UserSidebar({ collapsed, setCollapsed }) {
	const location = useLocation();
	const sidebarWidth = collapsed ? 60 : 220;

	return (
		<aside
			style={{
				position: "fixed",
				top: 0,
				left: 0,
				height: "100vh",
				width: sidebarWidth,
				background: COLORS.sidebar,
				color: "#fff",
				display: "flex",
				flexDirection: "column",
				transition: "width 0.2s",
				zIndex: 20,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", padding: 20 }}>
				<Camera size={28} />
				{!collapsed && (
					<span
						style={{
							fontWeight: "bold",
							fontSize: 20,
							marginLeft: 10,
						}}
					>
						AD Detect
					</span>
				)}
				<button
					style={{
						marginLeft: "auto",
						background: "none",
						border: "none",
						color: "#fff",
						cursor: "pointer",
						fontSize: 22,
					}}
					onClick={() => setCollapsed((c) => !c)}
					aria-label="Toggle sidebar"
				>
					☰
				</button>
			</div>
			<nav style={{ flex: 1 }}>
				{nav.map((item) => {
					const Icon = item.icon;
					const active = location.pathname === item.path;
					return (
						<Link
							key={item.path}
							to={item.path}
							style={{
								display: "flex",
								alignItems: "center",
								padding: "12px 20px",
								textDecoration: "none",
								color: "#fff",
								background: active ? COLORS.sidebarActive : "none",
								borderRadius: 8,
								margin: "4px 8px",
								fontWeight: active ? "bold" : "normal",
								transition: "background 0.2s",
							}}
							title={collapsed ? item.name : undefined}
						>
							<Icon size={20} />
							{!collapsed && (
								<span style={{ marginLeft: 12 }}>{item.name}</span>
							)}
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}