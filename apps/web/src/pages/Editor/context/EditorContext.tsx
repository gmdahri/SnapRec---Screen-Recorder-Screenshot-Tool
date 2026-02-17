import React, { createContext, useContext, useMemo, useCallback, type ReactNode } from 'react';
import { useFabricEditor } from '../../../hooks/useFabricEditor';
import { useEditorLifecycle } from '../../../hooks/useEditorLifecycle';
import { useAuth } from '../../../contexts/AuthContext';

type EditorContextType = ReturnType<typeof useFabricEditor> &
    ReturnType<typeof useEditorLifecycle> & {
        user: any;
        handleActionClick: (action: string) => void;
    };

const EditorContext = createContext<EditorContextType | undefined>(undefined);

export const EditorProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const fabricEditor = useFabricEditor();
    const editorLifecycle = useEditorLifecycle(fabricEditor.fabricCanvas);

    const handleActionClick = useCallback((action: string) => {
        if (!user) {
            editorLifecycle.setPendingAction(action);
            editorLifecycle.setShowLoginPrompt(true);
            return;
        }

        if (fabricEditor.isInitializing || !fabricEditor.fabricCanvas.current?.backgroundImage) {
            console.warn('EditorContext: Action ignored because canvas is still initializing or empty');
            return;
        }

        if (action === 'export') {
            const link = document.createElement('a');
            link.download = 'screenshot.png';
            link.href = fabricEditor.fabricCanvas.current?.toDataURL({ format: 'png' }) || '';
            link.click();
        } else if (action === 'share') {
            editorLifecycle.handleUploadToCloud();
        }
    }, [user, editorLifecycle, fabricEditor.fabricCanvas, fabricEditor.isInitializing]);

    const value = useMemo(() => ({
        ...fabricEditor,
        ...editorLifecycle,
        user,
        handleActionClick,
    }), [fabricEditor, editorLifecycle, user, handleActionClick]);

    // Auto-trigger pending action when user logs in - WAIT for canvas to be fully ready with image
    React.useEffect(() => {
        const canExecute = user &&
            editorLifecycle.pendingAction &&
            !fabricEditor.isInitializing &&
            !!fabricEditor.fabricCanvas.current?.backgroundImage;

        if (canExecute) {
            console.log('Executing pending action after login:', editorLifecycle.pendingAction);
            handleActionClick(editorLifecycle.pendingAction as string);
            editorLifecycle.setPendingAction(null);
        }
    }, [user, editorLifecycle.pendingAction, fabricEditor.isInitializing, handleActionClick, fabricEditor.fabricCanvas]);

    return (
        <EditorContext.Provider value={value}>
            {children}
        </EditorContext.Provider>
    );
};

export const useEditor = () => {
    const context = useContext(EditorContext);
    if (context === undefined) {
        throw new Error('useEditor must be used within an EditorProvider');
    }
    return context;
};
