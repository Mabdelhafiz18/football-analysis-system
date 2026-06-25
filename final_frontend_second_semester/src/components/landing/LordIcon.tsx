import React from 'react';

// Declare the custom element for TypeScript
declare global {
    namespace JSX {
        interface IntrinsicElements {
            'lord-icon': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & {
                src?: string;
                trigger?: string;
                colors?: string;
                delay?: string;
                speed?: string;
                target?: string;
                state?: string;
                style?: React.CSSProperties;
            }, HTMLElement>;
        }
    }
}

interface LordIconProps {
    src: string;
    trigger?: 'hover' | 'click' | 'loop' | 'loop-on-hover' | 'morph' | 'boomerang';
    size?: number | string;
    colors?: string;
    delay?: number;
    speed?: number | string;
    target?: string;
    className?: string;
}

export const LordIcon: React.FC<LordIconProps> = ({
    src,
    trigger = 'hover',
    size = 50,
    colors,
    delay,
    speed,
    target,
    className
}) => {
    return (
        <div className={className} style={{ width: size, height: size }}>
            <lord-icon
                src={src}
                trigger={trigger}
                colors={colors}
                delay={delay?.toString()}
                speed={speed?.toString()}
                target={target}
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
};
